-- V1 scale hardening: media limit 8, pagination-friendly indexes, and DB-side rate limits.

-- 1) Keep listing media cap aligned with product scope (max 8).
create or replace function public.enforce_listing_images_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  media_count integer;
begin
  select count(*)
  into media_count
  from public.listing_images li
  where li.listing_id = new.listing_id
    and (tg_op <> 'UPDATE' or li.id <> new.id);

  if media_count >= 8 then
    raise exception 'Maksimum 8 medya yukleyebilirsiniz.';
  end if;

  if not exists (
    select 1
    from public.listing_images li
    where li.listing_id = new.listing_id
      and (tg_op <> 'UPDATE' or li.id <> new.id)
  ) then
    new.is_cover := true;
    if new.sort_order is null or new.sort_order <> 0 then
      new.sort_order := 0;
    end if;
  end if;

  return new;
end;
$$;

-- 2) Indexes for listing filters and timeline queries.
create index if not exists listings_category_status_created_idx
  on public.listings(category_id, status, created_at desc);

create index if not exists listings_city_status_created_idx
  on public.listings(city, status, created_at desc);

create index if not exists listings_seller_status_created_idx
  on public.listings(seller_id, status, created_at desc);

create index if not exists listings_status_created_at_idx
  on public.listings(status, created_at desc);

-- 3) Rate limit: comments.
create or replace function public.enforce_comment_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
begin
  select count(*)
  into v_recent_count
  from public.listing_comments c
  where c.user_id = new.user_id
    and c.created_at >= now() - interval '1 minute';

  if v_recent_count >= 50 then
    raise exception 'Cok hizli yorum gonderiyorsunuz. Lutfen 1 dakika bekleyin.';
  end if;

  return new;
end;
$$;

drop trigger if exists listing_comments_rate_limit_guard on public.listing_comments;
create trigger listing_comments_rate_limit_guard
before insert on public.listing_comments
for each row execute function public.enforce_comment_insert_rate_limit();

-- 4) Rate limit: messages.
create or replace function public.enforce_message_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
begin
  select count(*)
  into v_recent_count
  from public.messages m
  where m.sender_id = new.sender_id
    and m.created_at >= now() - interval '1 minute';

  if v_recent_count >= 100 then
    raise exception 'Cok hizli mesaj gonderiyorsunuz. Lutfen 1 dakika bekleyin.';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_rate_limit_guard on public.messages;
create trigger messages_rate_limit_guard
before insert on public.messages
for each row execute function public.enforce_message_insert_rate_limit();

-- 5) Rate limit: listing creation.
create or replace function public.enforce_listing_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
begin
  if coalesce(new.status::text, '') = 'deleted' then
    return new;
  end if;

  select count(*)
  into v_recent_count
  from public.listings l
  where l.seller_id = new.seller_id
    and l.created_at >= now() - interval '10 minutes';

  if v_recent_count >= 30 then
    raise exception 'Kisa surede cok fazla ilan olusturdunuz. Lutfen daha sonra tekrar deneyin.';
  end if;

  return new;
end;
$$;

drop trigger if exists listings_rate_limit_guard on public.listings;
create trigger listings_rate_limit_guard
before insert on public.listings
for each row execute function public.enforce_listing_insert_rate_limit();
