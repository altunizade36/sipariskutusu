-- Add optional subcategory fields for marketplace listings.
-- Keeps category_id as main category while allowing "other" + custom detail.

alter table if exists public.listings
  add column if not exists sub_category_id text,
  add column if not exists custom_sub_category text;

create index if not exists idx_listings_sub_category_id
  on public.listings (sub_category_id);
