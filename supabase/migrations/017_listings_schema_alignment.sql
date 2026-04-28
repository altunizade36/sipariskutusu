-- Align listings with pending/active/rejected/sold/deleted workflow
-- and dedicated like/share counters.

alter table if exists public.listings
  add column if not exists like_count integer not null default 0;

alter table if exists public.listings
  add column if not exists share_count integer not null default 0;

update public.listings
set like_count = coalesce(like_count, favorite_count, 0)
where coalesce(like_count, 0) = 0;

update public.listings
set share_count = coalesce(share_count, 0)
where share_count is null;

do $$
begin
  begin
    alter type public.listing_status add value if not exists 'pending';
  exception when duplicate_object then null;
  end;

  begin
    alter type public.listing_status add value if not exists 'rejected';
  exception when duplicate_object then null;
  end;
end $$;

create or replace function public.increment_like_count(listing_id uuid)
returns void language sql security definer as $$
  update public.listings
  set like_count = coalesce(like_count, 0) + 1,
      favorite_count = coalesce(favorite_count, 0) + 1
  where id = listing_id;
$$;

create or replace function public.decrement_like_count(listing_id uuid)
returns void language sql security definer as $$
  update public.listings
  set like_count = greatest(coalesce(like_count, 0) - 1, 0),
      favorite_count = greatest(coalesce(favorite_count, 0) - 1, 0)
  where id = listing_id;
$$;

create or replace function public.increment_favorite_count(listing_id uuid)
returns void language sql security definer as $$
  select public.increment_like_count(listing_id);
$$;

create or replace function public.decrement_favorite_count(listing_id uuid)
returns void language sql security definer as $$
  select public.decrement_like_count(listing_id);
$$;

create or replace function public.increment_share_count(listing_id uuid)
returns void language sql security definer as $$
  update public.listings
  set share_count = coalesce(share_count, 0) + 1
  where id = listing_id;
$$;

create index if not exists listings_status_created_idx
  on public.listings(status, created_at desc);

create index if not exists listings_like_count_idx
  on public.listings(like_count desc);
