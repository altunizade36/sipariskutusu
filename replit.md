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

## Mobile App Key Screens

- **Splash** — Mascot animation (box-loading.png), spring entry, loading dots
- **Account / Profile** — 10-section settings hub (see below)
- **Notification Settings** — `/notification-settings` — 8 per-type toggle switches (AsyncStorage)
- **Profile Edit** — `/profile-edit` — name, email, bio, phone, avatar upload
- **Store Settings** — `/store-settings` — cover photo, icon picker, delivery, IG handle
- **Security** — `/security` — password, 2FA, sessions, login history
- **Preferences** — `/preferences` — language, currency, theme
- **Notifications** — `/notifications` — notification list with read/delete

### Account Screen Sections (app/(tabs)/account.tsx)
1. Hesap Ayarları — Kişisel Bilgiler, Telefon/E-posta, Şifre Değiştir, Hesabı Dondur, Hesap Silme
2. Mağaza Ayarları — Mağaza Profili, Instagram Bağlantısı, Görünürlük toggle, Tatil Modu toggle
3. Bildirim Ayarları — → /notification-settings, → /notifications
4. Gizlilik ve Güvenlik — Güvenlik, Engellenen Kullanıcılar, Şikayet Geçmişi, Profil Görünürlük toggle
5. Dil ve Bölge — → /preferences
6. Görünüm — Koyu Mod toggle, Tema Tercihleri → /preferences
7. Favori ve Takip — Favoriler, Takip Listesi, Son Baktıklarım, Kaydedilen Aramalar
8. Destek — Canlı Destek, Yardım Merkezi, E-posta, Geri Bildirim
9. Yasal — Kullanım Şartları, Gizlilik & KVKK, Yasaklı Ürünler, Sorumluluk Reddi
10. Uygulama — Sürüm Bilgisi, Önbellek Temizle, Hata Bildir, Çıkış Yap

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

### Font Loading & 6000ms Timeout Fix
- `app/_layout.tsx` — Splashscreen timeout reduced to 1500ms; `LogBox.ignoreLogs(['timeout exceeded', 'fontfaceobserver', '6000ms'])` added at module level; native `ErrorUtils.setGlobalHandler` suppresses font timeouts on Expo Go; web bypasses `useFonts` entirely (`Platform.OS === 'web' ? {}`)
- `web/index.html` — `unhandledrejection` handler with `capture: true` + `stopImmediatePropagation()` to prevent Sentry/Expo from capturing font timeout errors before our handler
- `src/services/monitoring.ts` — Sentry `ignoreErrors: ['timeout exceeded', ...]` + `beforeSend` null-return for font errors

### Notification System
- `src/services/inAppNotificationService.ts` — 15 notification types; added `deleteNotification()`, `clearAllNotifications()`, `createInAppNotification(targetUserId, type, title, body, data?)`; full RPC + direct-table fallback
- `src/hooks/useUnreadNotificationCount.ts` — Real-time unread notification count hook using Supabase Realtime; auto-refreshes on notification changes
- `app/notifications.tsx` — Full professional notification center: type-specific icons (15 types mapped to color+icon), relative time formatting ("Az önce", "2 dk önce", "Dün"), filter tabs (Tümü/Okunmamış), swipe/long-press-to-delete with Animated slide, "Tümünü Temizle" with confirmation, "Tümünü oku", pull-to-refresh, unread blue highlight with left border
- `app/(tabs)/_layout.tsx` — Account tab now visible (removed `href: null`); `useUnreadNotificationCount` badge on Profile tab; Store tab hidden (accessible from Account > Mağazam)

### Notification Dispatch Service
- `src/services/notificationDispatchService.ts` — 4 dispatch functions: `dispatchFavoriteNotification()`, `dispatchLikeNotification()`, `dispatchFollowNotification()`, `dispatchPriceDropNotification()`; spam-prevention via in-memory throttle (24h window); fire-and-forget pattern; self-notification guard
- `src/services/favoriteService.ts` — `toggleFavorite()` now dispatches `dispatchFavoriteNotification` on add (fire-and-forget)

### Favorites System
- `app/(tabs)/favorites.tsx` — Added search bar (searches by title, brand, category); `searchQuery` state with clear button; integrated into `visibleFavorites` useMemo filter chain

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

### Kategori Sistemi (Categories)
- `src/constants/marketplaceCategories.ts` — Single source of truth for all 13 categories + subcategories (with keywords for client-side matching)
- `app/(tabs)/categories.tsx` — Full rewrite of empty state: category emoji icon, "Bu kategoride henüz ürün yok", "İlk ilanı sen yayınlayabilirsin!", "İlan Ver" action button (→ /create-listing or /store-setup based on hasStore), error state with retry button, city display on product cards
- `src/services/listingService.ts` — `sub_category_id` removed from SELECT and WHERE clauses (column does not exist in current DB schema); INSERT has chained retry logic to strip `sub_category_id`/`custom_sub_category` columns if DB returns error 42703. All subcategory filtering is client-side only (keyword match OR sub_category_id property access on returned JS objects).

### İlan Ver (Create Listing) Preview
- `app/create-listing.tsx` — Preview section fully redesigned: full-width 4:3 image carousel with dots, photo count badge, YAYINA HAZIR/TASLAK status badge, large price display, bargaining/condition tags, seller info row with action buttons, description box with character count, 3-column completion tracker grid

### ProductDetailScreen Overhaul
- `app/product/[id].tsx` — Full UX/UI overhaul:
  - **Swipe image carousel** with pagingEnabled ScrollView, dot indicators, image counter badge (n/total), discount badge overlay
  - **Sipariş Kutusu placeholder** via `src/components/ProductImagePlaceholder.tsx` (cube icon + brand name diagonal, shown when no media)
  - **Floating header** now includes heart (favorite) button alongside share — both with translucent white pill style
  - **Mağaza kartı** redesigned: larger storefront avatar (54px), star rating, "Onaylı Satıcı" label, "Mağazaya Git" primary button, divider, Mesaj + WhatsApp action buttons
  - **"Devamını Oku"** toggle for descriptions longer than 200 chars (4-line clamp with expand/collapse)
  - **Beden seçici** only rendered when `product.availableSizes?.length > 0` (no more fake XS/S/M/L/XL)
  - **Benzer İlanlar** switched from horizontal scroll to 2-column wrap grid (max 6 items)
  - **Sticky bottom bar** now has heart favorite button + "Satıcıya Mesaj Gönder" with icon
  - **Dark mode** via `pal` palette object derived from `isDarkMode` — applied across all sections
  - **Session/auth error suppression** in comments error display
  - Removed duplicate message button from mağaza kartı (consolidated to bottom bar)
- `src/components/ProductImagePlaceholder.tsx` — New reusable component: `size="full|card|thumb"`, shows cube icon + "Sipariş Kutusu" text at 10deg tilt with 35% opacity, slate color
