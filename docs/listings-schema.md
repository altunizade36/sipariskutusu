# Listings Schema

Current target structure for `public.listings`:

- `id`
- `seller_id`
- `title`
- `description`
- `price`
- `category_id`
- `city`
- `district`
- `status` (`pending`, `active`, `rejected`, `sold`, `deleted`)
- `view_count`
- `like_count`
- `share_count`
- `created_at`
- `updated_at`

Compatibility notes:

- Existing deployments may still have `favorite_count`. Migration `017_listings_schema_alignment.sql` keeps it synchronized with `like_count` for backward compatibility.
- Older `paused` statuses are migrated to `pending`.
