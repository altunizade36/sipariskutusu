-- V1 scope hardening: favorite/share engagement notifications + explicit RPC grants.

-- 1) Extend notification enum for engagement events.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'notification_type'
      and e.enumlabel = 'listing_favorited'
  ) then
    alter type public.notification_type add value 'listing_favorited';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'notification_type'
      and e.enumlabel = 'listing_shared'
  ) then
    alter type public.notification_type add value 'listing_shared';
  end if;
end $$;

-- 2) Seller notification when a listing is favorited.
create or replace function public.notify_listing_favorited()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_already_notified boolean := false;
begin
  select l.seller_id
  into v_seller_id
  from public.listings l
  where l.id = new.listing_id;

  if v_seller_id is null or v_seller_id = new.user_id then
    return new;
  end if;

  -- Deduplicate same actor->listing signal for 24h.
  select exists (
    select 1
    from public.notifications n
    where n.user_id = v_seller_id
      and n.type = 'listing_favorited'
      and n.created_at >= now() - interval '24 hours'
      and coalesce(n.data ->> 'listing_id', '') = new.listing_id::text
      and coalesce(n.data ->> 'actor_user_id', '') = new.user_id::text
  )
  into v_already_notified;

  if not v_already_notified then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      v_seller_id,
      'listing_favorited',
      'İlanın favorilere eklendi',
      'Bir kullanıcı ilanını favorilerine ekledi.',
      jsonb_build_object(
        'listing_id', new.listing_id,
        'actor_user_id', new.user_id,
        'event', 'favorite_added'
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists favorites_notify_listing_favorited on public.favorites;
create trigger favorites_notify_listing_favorited
after insert on public.favorites
for each row execute function public.notify_listing_favorited();

-- 3) Share counter + optional seller notification (auth users only), with 24h dedupe.
create or replace function public.increment_share_count(listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_seller_id uuid;
  v_already_notified boolean := false;
begin
  update public.listings l
  set share_count = coalesce(l.share_count, 0) + 1
  where l.id = listing_id
  returning l.seller_id into v_seller_id;

  if not found then
    raise exception 'Listing not found.';
  end if;

  if v_actor_user_id is null then
    return;
  end if;

  if v_seller_id is null or v_seller_id = v_actor_user_id then
    return;
  end if;

  select exists (
    select 1
    from public.notifications n
    where n.user_id = v_seller_id
      and n.type = 'listing_shared'
      and n.created_at >= now() - interval '24 hours'
      and coalesce(n.data ->> 'listing_id', '') = listing_id::text
      and coalesce(n.data ->> 'actor_user_id', '') = v_actor_user_id::text
  )
  into v_already_notified;

  if not v_already_notified then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      v_seller_id,
      'listing_shared',
      'İlanın paylaşıldı',
      'Bir kullanıcı ilanını paylaştı.',
      jsonb_build_object(
        'listing_id', listing_id,
        'actor_user_id', v_actor_user_id,
        'event', 'listing_shared'
      )
    );
  end if;
end;
$$;

-- 4) Explicit grants for engagement counter RPCs.
revoke all on function public.increment_like_count(uuid) from public;
revoke all on function public.increment_like_count(uuid) from anon;
grant execute on function public.increment_like_count(uuid) to authenticated;

revoke all on function public.decrement_like_count(uuid) from public;
revoke all on function public.decrement_like_count(uuid) from anon;
grant execute on function public.decrement_like_count(uuid) to authenticated;

revoke all on function public.increment_share_count(uuid) from public;
revoke all on function public.increment_share_count(uuid) from anon;
grant execute on function public.increment_share_count(uuid) to authenticated;
grant execute on function public.increment_share_count(uuid) to anon;
