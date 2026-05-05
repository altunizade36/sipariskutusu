# Threat Model

## Project Overview

Sipariş Kutusu is a Turkish e-commerce marketplace with an Expo/React Native mobile app, a static Vite/React admin panel, Supabase as the primary backend (Auth, PostgreSQL, Storage, Realtime, Edge Functions), and an address/performance NestJS module. Production deployment serves the static admin panel and mobile builds; Supabase and exposed edge/backend endpoints are the main server-side trust boundaries.

## Assets

- **User accounts and sessions** -- Supabase Auth users, refresh/access tokens, OTP/password reset flows, and locally persisted auth state. Compromise enables account takeover and access to private marketplace data.
- **Marketplace and moderation data** -- listings, stores, orders, reports, comments, notifications, audit/moderation actions, subscriptions, credit wallets, and RevenueCat events. Tampering could approve abusive content, ban users, alter credits, or expose business data.
- **Private communications and media** -- conversations, messages, message attachments, addresses, push tokens, and profile details. These require strict per-user access control.
- **Admin privileges** -- `profiles.role = 'admin'`, admin panel access, and SECURITY DEFINER RPCs for moderation and user management. Unauthorized access would allow broad data exposure and destructive moderation actions.
- **Application secrets** -- Supabase service-role keys, FCM keys, SMS/SendGrid keys, RevenueCat webhook secrets, Sentry/PostHog public keys, and backend database/Redis connection strings. Server-side secrets must never be exposed to clients or logs.

## Trust Boundaries

- **Mobile/browser client to Supabase** -- clients use public anon keys and are untrusted. Supabase RLS, storage policies, and RPC checks must enforce all authorization server-side.
- **Admin panel to Supabase** -- the admin UI performs direct Supabase queries/RPC calls from a browser. Client-side role checks are UX only; database policies and admin RPCs must reject non-admin users.
- **External webhooks/services to edge functions** -- RevenueCat, push/SMS/email providers, and visual/payment functions cross external service boundaries. Webhooks and sensitive operations must authenticate callers and validate payloads.
- **Backend module HTTP API to database/Redis** -- the NestJS address/performance module exposes HTTP endpoints and uses TypeORM/Redis. Public endpoints must not expose privileged ops, internal configuration, or unbounded resource usage.
- **Client local storage to application state** -- AsyncStorage/SecureStore/cache data can be modified by a user with device/browser access and must not be trusted for authorization or pricing decisions.
- **Development vs production** -- mockups, scripts, smoke tests, Expo dev tooling, attached assets, and local-only utilities are out of production scope unless reachable from deployed production entry points. In production, `NODE_ENV` is assumed to be `production`, Replit provides TLS, and platform certificate renewal is handled externally.

## Scan Anchors

- **Production entry points:** `app/`, `src/`, `web-admin/src/`, `supabase/functions/`, `supabase/migrations/`, and `address-module/backend/src/` if the backend module is deployed.
- **High-risk code:** `src/context/AuthContext.tsx`, `src/services/backendApiClient.ts`, `src/services/*Service.ts` files that call Supabase, `web-admin/src/components/AuthGuard.tsx`, `web-admin/src/pages/*`, `supabase/functions/*/index.ts`, and Supabase migrations defining RLS/admin RPCs.
- **Public surfaces:** marketplace browsing/listings/stories/search, address lookup, auth/login/signup/OTP/reset, edge functions, and any unauthenticated backend health/ops endpoints.
- **Authenticated surfaces:** listings creation/editing, favorites, orders, addresses, conversations/messages, notifications, reports, profile/store settings, uploads, subscriptions/credits.
- **Admin surfaces:** static admin panel routes plus RPCs/functions such as `get_pending_listings_admin`, `review_listing_admin`, `get_open_reports_admin`, `review_report_admin`, `ban_user_admin`, `unban_user_admin`, and admin data queries.
- **Usually dev-only/out of scope:** `scripts/`, tests, `.expo/`, `attached_assets/`, docs, mockup-only files, scanner findings in local release scripts, and dependency files under `node_modules/`, unless production reachability is demonstrated.

## Threat Categories

### Spoofing

Supabase Auth is the identity source of truth. Every protected API, RPC, storage policy, and backend request must validate a real Supabase session and must not trust client-only demo users, local storage, or route state. External webhooks must authenticate with a strong shared secret or signed provider mechanism.

### Tampering

Clients can modify any request body, route parameter, local cache, or bundled JavaScript. Listings, reports, comments, credits, subscriptions, order state, notification delivery, and moderation actions must enforce ownership/admin checks in Supabase RLS or server-side code. Client-side admin guards and UI filters are not security controls.

### Repudiation

Admin moderation, bans/unbans, report resolution, credit/subscription changes, and sensitive account actions should leave durable audit records with the acting authenticated user and timestamp. Logs should support abuse investigation without leaking secrets or private message content.

### Information Disclosure

Private data such as messages, message attachments, addresses, push tokens, reports, subscription/credit records, and non-public user/profile fields must be scoped by RLS or server-side checks. Edge/backend errors and ops/config endpoints must not reveal service keys, infrastructure internals, or broad user datasets to unauthenticated users.

### Denial of Service

Public search, address, upload, auth, notification, and edge-function endpoints must enforce request size limits, rate limits, timeouts, and pagination. Server-side calls to external providers should be bounded so attackers cannot exhaust database, Redis, storage, or third-party API quotas.

### Elevation of Privilege

Admin status is stored in `profiles.role`; all admin functions must verify `auth.uid()` against trusted profile data inside the database or server-side code. SECURITY DEFINER functions must avoid SQL injection, unsafe search paths, and overly broad grants. Storage bucket policies must prevent users from writing/deleting objects outside their own namespace or reading private message media without conversation membership.