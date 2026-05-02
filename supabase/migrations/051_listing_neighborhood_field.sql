-- Add optional neighborhood field for full location selection (city > district > neighborhood).

alter table if exists public.listings
  add column if not exists neighborhood text;

create index if not exists idx_listings_neighborhood
  on public.listings (neighborhood);
