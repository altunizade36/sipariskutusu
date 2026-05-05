# Listing Moderation System

Workflow:

1. Seller submits listing.
2. Listing status is set to `pending`.
3. Automated prechecks run and results are stored in `listing_moderation_audits`.
4. Admin reviews pending listings.
5. Admin sets listing to `active` or `rejected`.
6. Only `active` listings are visible in marketplace feeds.

Automated checks:

- Title is not empty.
- Description is sufficient.
- Price is valid.
- Category is selected.
- At least one media item exists.
- Prohibited words are not detected.
- Seller is verified.
- Media filename/url does not contain suspicious terms (and backend moderation endpoint can be used when available).

Main code:

- `createListing` runs prechecks, saves listing as pending, uploads media, stores moderation audit.
- `updateListing` sends edited listings back to pending for re-review.
- `fetchPendingListings` returns moderation queue (admin only).
- `reviewListing` now calls Supabase RPC `review_listing_admin` for atomic admin decision + audit write.

Database:

- `public.listings` includes review fields: `reviewed_by`, `reviewed_at`, `rejection_reason`.
- `public.listing_moderation_audits` stores automated/manual moderation history.

Supabase hardening (migration `020_listing_moderation_hardening.sql`):

- Replaced legacy broad seller `FOR ALL` listing policy with granular seller policies.
- Added admin listing select/update policies so pending queue and review are enforced in RLS.
- Added `public.is_admin(user_id uuid)` helper function used by policies and triggers.
- Added `listings_moderation_guardrails` trigger to block seller self-approval and force re-review on sensitive edits.
- Added `listing_moderation_audits_integrity` trigger to protect manual-vs-automated audit write integrity.
- Added `public.review_listing_admin(...)` RPC for secure, single-transaction admin approve/reject flow.
