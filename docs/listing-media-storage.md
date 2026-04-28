# Listing Media Storage

Listing media files are stored in Supabase Storage under the `listing-images` bucket.

Database rows in `public.listing_images` keep only metadata:

- `id`
- `listing_id`
- `url`
- `storage_path`
- `sort_order`
- `is_cover`
- `created_at`

Notes:

- `url` is the public URL used by the app.
- `storage_path` is the bucket-relative object path used for safe cleanup and media replacement.
- Existing rows are backfilled from the current public URL format by migration `016_listing_images_storage_path.sql`.

Current media upload guarantees:

- Maximum `8` media items per listing (app + DB guardrails).
- Image uploads are automatically compressed to `WebP` or `JPEG` before storage upload.
- Default per-image size target is `<= 3 MB` (configurable via `EXPO_PUBLIC_MAX_IMAGE_BYTES`).
- First media is always treated as cover (`is_cover = true`) and cover consistency is normalized in DB.
- DB hardening for cover and count rules is implemented in migrations `021_listing_images_hardening.sql` and `032_v1_scale_hardening.sql`.
