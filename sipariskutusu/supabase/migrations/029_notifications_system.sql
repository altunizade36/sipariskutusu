-- Notifications system hardening: new notification types, event triggers, and safe user RPCs.

-- Ensure enum contains all notification categories used by app workflows.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'notification_type'
      and e.enumlabel = 'listing_approved'
  ) then
    alter type public.notification_type add value 'listing_approved';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'notification_type'
      and e.enumlabel = 'listing_rejected'
  ) then
    alter type public.notification_type add value 'listing_rejected';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'notification_type'
      and e.enumlabel = 'listing_comment'
  ) then
    alter type public.notification_type add value 'listing_comment';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'notification_type'
      and e.enumlabel = 'favorite_listing_comment'
  ) then
    alter type public.notification_type add value 'favorite_listing_comment';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'notification_type'
      and e.enumlabel = 'seller_approved'
  ) then
    alter type public.notification_type add value 'seller_approved';
  end if;
end $$;

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

create or replace function public.fetch_my_notifications(
  p_limit integer default 100,
  p_only_unread boolean default false
)
returns table (
  id uuid,
  user_id uuid,
  type public.notification_type,
  title text,
  body text,
  data jsonb,
  is_read boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
begin
  if v_user_id is null then
    raise exception 'Giriş yapmanız gerekiyor.';
  end if;

  return query
  select
    n.id,
    n.user_id,
    n.type,
    n.title,
    n.body,
    n.data,
    n.is_read,
    n.created_at
  from public.notifications n
  where n.user_id = v_user_id
    and (not p_only_unread or n.is_read = false)
  order by n.created_at desc
  limit v_limit;
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Giriş yapmanız gerekiyor.';
  end if;

  update public.notifications n
  set is_read = true
  where n.id = p_notification_id
    and n.user_id = v_user_id;

  if not found then
    raise exception 'Bildirim bulunamadı.';
  end if;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Giriş yapmanız gerekiyor.';
  end if;

  update public.notifications n
  set is_read = true
  where n.user_id = v_user_id
    and n.is_read = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.notify_listing_review_result()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status <> 'pending' then
    return new;
  end if;

  if new.status = 'active' then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      new.seller_id,
      'listing_approved',
      'İlanın onaylandı',
      coalesce(new.title, 'İlanın') || ' yayına alındı.',
      jsonb_build_object(
        'listing_id', new.id,
        'status', new.status,
        'reviewed_by', new.reviewed_by,
        'reviewed_at', new.reviewed_at
      )
    );
  elsif new.status = 'rejected' then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      new.seller_id,
      'listing_rejected',
      'İlanın reddedildi',
      coalesce(new.rejection_reason, 'İlanın moderasyon nedeniyle reddedildi.'),
      jsonb_build_object(
        'listing_id', new.id,
        'status', new.status,
        'reason', new.rejection_reason,
        'reviewed_by', new.reviewed_by,
        'reviewed_at', new.reviewed_at
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists listings_notify_review_result on public.listings;
create trigger listings_notify_review_result
after update of status on public.listings
for each row execute function public.notify_listing_review_result();

create or replace function public.notify_listing_comment_events()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_listing_owner_id uuid;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select l.seller_id
  into v_listing_owner_id
  from public.listings l
  where l.id = new.listing_id;

  if v_listing_owner_id is not null and v_listing_owner_id <> new.user_id then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      v_listing_owner_id,
      'listing_comment',
      'İlanına yorum geldi',
      left(coalesce(new.comment, 'Yeni yorum'), 180),
      jsonb_build_object(
        'listing_id', new.listing_id,
        'comment_id', new.id,
        'comment_user_id', new.user_id
      )
    );
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  select
    f.user_id,
    'favorite_listing_comment',
    'Favorindeki ilana yeni yorum geldi',
    left(coalesce(new.comment, 'Yeni yorum'), 180),
    jsonb_build_object(
      'listing_id', new.listing_id,
      'comment_id', new.id,
      'comment_user_id', new.user_id
    )
  from public.favorites f
  where f.listing_id = new.listing_id
    and f.user_id <> new.user_id
    and (v_listing_owner_id is null or f.user_id <> v_listing_owner_id);

  return new;
end;
$$;

drop trigger if exists listing_comments_notify_events on public.listing_comments;
create trigger listing_comments_notify_events
after insert on public.listing_comments
for each row execute function public.notify_listing_comment_events();

create or replace function public.notify_seller_approved_from_store()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_is_seller boolean := false;
  v_role text := null;
begin
  if coalesce(old.is_verified, false) = false
     and coalesce(new.is_verified, false) = true then
    select coalesce(p.is_seller, false), p.role
    into v_is_seller, v_role
    from public.profiles p
    where p.id = new.seller_id;

    if v_is_seller = false and v_role <> 'seller' then
      return new;
    end if;

    insert into public.notifications (user_id, type, title, body, data)
    values (
      new.seller_id,
      'seller_approved',
      'Satıcı onaylandı',
      'Satıcı hesabın onaylandı. İlanlarını yayınlamaya başlayabilirsin.',
      jsonb_build_object('profile_id', new.seller_id, 'store_id', new.id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists stores_notify_seller_approved on public.stores;
create trigger stores_notify_seller_approved
after update of is_verified on public.stores
for each row execute function public.notify_seller_approved_from_store();

create or replace function public.notify_seller_approved_from_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(old.is_verified, false) = false
     and coalesce(new.is_verified, false) = true
     and (coalesce(new.is_seller, false) = true or new.role = 'seller') then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      new.id,
      'seller_approved',
      'Satıcı onaylandı',
      'Satıcı hesabın onaylandı. İlanlarını yayınlamaya başlayabilirsin.',
      jsonb_build_object('profile_id', new.id)
    );
  end if;

  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'is_verified'
  ) then
    execute 'drop trigger if exists profiles_notify_seller_approved on public.profiles';
    execute 'create trigger profiles_notify_seller_approved after update of is_verified on public.profiles for each row execute function public.notify_seller_approved_from_profile()';
  end if;
end $$;

-- Grants + hardening
revoke all on function public.fetch_my_notifications(integer, boolean) from public;
revoke all on function public.fetch_my_notifications(integer, boolean) from anon;
grant execute on function public.fetch_my_notifications(integer, boolean) to authenticated;

revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.mark_notification_read(uuid) from anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

revoke all on function public.mark_all_notifications_read() from public;
revoke all on function public.mark_all_notifications_read() from anon;
grant execute on function public.mark_all_notifications_read() to authenticated;
