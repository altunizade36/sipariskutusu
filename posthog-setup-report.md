<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Sipariş Kutusu Expo (React Native) project.

## Summary of changes

- **`src/services/monitoring.ts`** — Exported `getPostHogClient()` so the singleton can be passed to `PostHogProvider`; added `debug: __DEV__` flag.
- **`app/_layout.tsx`** — Added `PostHogProvider` wrapping the app (with autocapture for touches), plus manual screen tracking via `usePathname` / `useGlobalSearchParams` on every route change.
- **`src/context/AuthContext.tsx`** — Added `trackEvent` / `TELEMETRY_EVENTS` imports; fires `user_signed_out` on sign-out; enriched `identifyUser` call with `account_role` from user metadata.
- **`app/auth.tsx`** — Fires `user_signed_in` (method: email or demo, with role) and `user_signed_up` (method: email, account_role) on successful authentication.
- **`app/cart.tsx`** — Fires `cart_initiated` on mount, `cart_step_advanced` on each step transition, and `order_draft_sent` (the key conversion event) before sending the order message.
- **`app/product/[id].tsx`** — Fires `product_viewed` alongside the existing `recentlyViewed.add()` call each time a product detail page loads.
- **`app/(tabs)/store.tsx`** — Fires `store_viewed` when a seller store page is opened by `sellerId` or `storeKey`.
- **`app/story-viewer.tsx`** — Fires `story_viewed` each time a story starts playing (alongside `markStorySeen`).
- **`app/share-story.tsx`** — Fires `story_shared` after a story is successfully published.
- **`src/constants/telemetryEvents.ts`** — Added 10 new event constants with full typed payloads: `PRODUCT_VIEWED`, `CART_INITIATED`, `CART_STEP_ADVANCED`, `ORDER_DRAFT_SENT`, `USER_SIGNED_IN`, `USER_SIGNED_UP`, `USER_SIGNED_OUT`, `STORE_VIEWED`, `STORY_VIEWED`, `STORY_SHARED`.
- **`.env`** — Set `EXPO_PUBLIC_POSTHOG_API_KEY` and `EXPO_PUBLIC_POSTHOG_HOST` to the correct project values.

## Event tracking table

| Event name | Description | File |
|---|---|---|
| `product_viewed` | User views a product detail page (top of conversion funnel) | `app/product/[id].tsx` |
| `cart_initiated` | User opens the cart/checkout flow for a product | `app/cart.tsx` |
| `cart_step_advanced` | User advances from cart → payment → confirm step | `app/cart.tsx` |
| `order_draft_sent` | User confirms and sends the draft order message to seller (key conversion) | `app/cart.tsx` |
| `user_signed_in` | User successfully logs in (email or demo, with role) | `app/auth.tsx` |
| `user_signed_up` | User creates a new account (with account_role) | `app/auth.tsx` |
| `user_signed_out` | User signs out | `src/context/AuthContext.tsx` |
| `store_viewed` | User views a seller store page | `app/(tabs)/store.tsx` |
| `story_viewed` | User views a product story | `app/story-viewer.tsx` |
| `story_shared` | User successfully publishes a product story | `app/share-story.tsx` |

Pre-existing events (already tracked before this integration):

| Event name | Description | File |
|---|---|---|
| `search_submitted` | Search query submitted | `app/search.tsx` |
| `search_results_loaded` | Search results loaded | `app/search.tsx` |
| `search_filters_applied` | Filters applied to search | `app/search.tsx` |
| `search_result_product_clicked` | Product clicked in search results | `app/search.tsx` |
| `search_result_store_clicked` | Store clicked in search results | `app/search.tsx` |
| `listing_created` | New listing created | `app/create-listing.tsx` |
| `listing_comment_submitted` | Comment submitted on a listing | `app/product/[id].tsx` |
| `similar_listing_clicked` | Similar listing clicked on product page | `app/product/[id].tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://eu.posthog.com/project/169891/dashboard/653970
- **Purchase Conversion Funnel** (product_viewed → cart_initiated → cart_step_advanced → order_draft_sent): https://eu.posthog.com/project/169891/insights/mZmZJqiX
- **New User Signups (Daily)** (buyer vs seller breakdown): https://eu.posthog.com/project/169891/insights/MGDzLavc
- **Product Views vs Order Drafts (Daily)** (top-of-funnel vs conversion trend): https://eu.posthog.com/project/169891/insights/ySnolrOF
- **User Sign-in vs Sign-out (Churn signal)**: https://eu.posthog.com/project/169891/insights/uPsOydhN
- **Content Engagement: Stories vs Store Views**: https://eu.posthog.com/project/169891/insights/f1D6KUbj

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-expo/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
