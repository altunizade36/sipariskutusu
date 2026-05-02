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
