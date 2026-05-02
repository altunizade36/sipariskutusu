# Sipariş Kutusu

A Turkish e-commerce marketplace app ("Order Box") — an Expo/React Native mobile app with a separate web-based admin panel.

## Project Structure

- **`/app`** — Expo Router screens (mobile app routes)
- **`/src`** — Shared source code (components, hooks, services, utils, context)
- **`/web-admin`** — Vite + React admin panel (runs in browser, port 5000)
- **`/web`** — Web entry point for Expo web build
- **`/supabase`** — Supabase edge functions and migrations
- **`/scripts`** — Utility and smoke test scripts

## Tech Stack

- **Mobile:** Expo (React Native) with Expo Router, NativeWind (Tailwind for RN)
- **Admin Panel:** Vite + React + TypeScript + React Router DOM
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Analytics:** PostHog
- **Error Tracking:** Sentry

## Running the Project

The **web-admin panel** is the primary frontend served in Replit:

```bash
cd web-admin && npm run dev
```

Runs on port 5000.

## Environment Variables

See `.env.example` for all required variables. Key ones:

- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon public key

For the web-admin panel, set in `web-admin/.env`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Deployment

Configured as a static site deployment:
- **Build:** `cd web-admin && npm run build`
- **Public dir:** `web-admin/dist`

## Admin Panel Features

- Dashboard
- Listings management
- Reports moderation
- Comments moderation
- Users management
- Operations (Ops)
- Audit log
- Analytics
- Stores management
- Settings

## Mobile App Features

### i18n (TR/EN)
- `src/i18n/tr.ts`, `src/i18n/en.ts`, `src/i18n/index.ts`
- Module-level `t` constant — no React hooks needed
- Auto-detects device locale (TR default, EN if locale starts with 'en')

### Responsive Utilities
- `src/utils/responsive.ts` — `wp()`, `hp()`, `clamp()`, `calcCardWidth()`, `scaledFont()`, `TAB_BAR_HEIGHT`

### Instagram Business/Creator Integration
- `src/services/instagramService.ts` — Caption parser (extracts price, category, size, color, city, stock from Turkish text), mock Instagram API data (6 posts, 3 reels, 3 stories), AsyncStorage-based connection management
- `app/instagram-connect.tsx` — Connect/manage Instagram Business or Creator accounts with mock OAuth flow
- `app/instagram-content.tsx` — 3-tab screen (Gönderiler/Reels/Hikayeler), grid layout, "Ürüne Çevir" → quick-publish, "Hikayeye Çevir" → share-story, multi-select bulk publish
- `app/instagram-quick-publish.tsx` — Auto-parsed product draft display with EKSİK badges for missing fields, category quick-picker, direct publish via `submitListingToSupabase`, "Detaylı Düzenle" → create-listing with prefilled params
- `app/(tabs)/account.tsx` — Instagram integration card for sellers (connected status + follower count or CTA to connect)
- `app/(tabs)/store.tsx` — Instagram analytics panel in the About tab for store owners
