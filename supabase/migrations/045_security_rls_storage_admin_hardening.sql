-- ============================================================
-- 045_security_rls_storage_admin_hardening.sql
-- Comprehensive security hardening:
-- - Admin RPC access control
-- - Profile privilege escalation guard
-- - Message ownership update/delete guard
-- - Storage bucket policy hardening
-- - Explicit anon delete lock
-- ============================================================

create or replace function public.is_admin_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin_profile(uuid) from public;
revoke all on function public.is_admin_profile(uuid) from anon;
grant execute on function public.is_admin_profile(uuid) to authenticated;

-- ------------------------------------------------------------
-- Admin RPC functions must enforce admin role in-body
-- ------------------------------------------------------------

create or replace function public.get_pending_listings_admin(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  price numeric,
  status text,
  created_at timestamptz,
  user_id uuid,
  user_name text,
  cover_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  if not public.is_admin_profile(v_uid) then
    raise exception 'Only admins can access pending listings.';
  end if;

  return query
  select
    l.id,
    l.title,
    l.price,
    l.status,
    l.created_at,
    l.seller_id as user_id,
    coalesce(p.full_name, 'Anonim') as user_name,
    (select li.url from public.listing_images li where li.listing_id = l.id and li.is_cover = true limit 1) as cover_url
  from public.listings l
  left join public.profiles p on p.id = l.seller_id
  where l.status = 'pending'
  order by l.created_at asc
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.get_open_reports_admin(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  target_type text,
  target_id uuid,
  reason text,
  status text,
  created_at timestamptz,
  reporter_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  if not public.is_admin_profile(v_uid) then
    raise exception 'Only admins can access reports queue.';
  end if;

  return query
  select
    r.id,
    r.target_type,
    r.target_id,
    r.reason,
    r.status,
    r.created_at,
    coalesce(p.full_name, 'Anonim') as reporter_name
  from public.reports r
  left join public.profiles p on p.id = r.reporter_id
  where r.status = 'pending'
  order by r.created_at asc
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.ban_user_admin(
  p_user_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  if not public.is_admin_profile(v_uid) then
    raise exception 'Only admins can ban users.';
  end if;

  update public.profiles
  set
    is_banned = true,
    banned_at = now(),
    banned_reason = p_reason,
    banned_by = v_uid,
    updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'User not found.';
  end if;
end;
$$;

create or replace function public.unban_user_admin(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  if not public.is_admin_profile(v_uid) then
    raise exception 'Only admins can unban users.';
  end if;

  update public.profiles
  set
    is_banned = false,
    banned_at = null,
    banned_reason = null,
    banned_by = null,
    updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'User not found.';
  end if;
end;
$$;

revoke all on function public.get_pending_listings_admin(integer, integer) from public, anon;
revoke all on function public.get_open_reports_admin(integer, integer) from public, anon;
revoke all on function public.ban_user_admin(uuid, text) from public, anon;
revoke all on function public.unban_user_admin(uuid) from public, anon;

grant execute on function public.get_pending_listings_admin(integer, integer) to authenticated;
grant execute on function public.get_open_reports_admin(integer, integer) to authenticated;
grant execute on function public.ban_user_admin(uuid, text) to authenticated;
grant execute on function public.unban_user_admin(uuid) to authenticated;

-- ------------------------------------------------------------
-- Profiles: prevent self privilege escalation
-- ------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists "Kendi profilini güncelleyebilir" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_owner_only_v2"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  v_is_admin := public.is_admin_profile(v_uid);

  if not v_is_admin and v_uid is distinct from old.id then
    raise exception 'Cannot update another user profile.';
  end if;

  if not v_is_admin then
    if new.role is distinct from old.role
      or new.is_seller is distinct from old.is_seller
      or new.is_banned is distinct from old.is_banned
      or new.banned_at is distinct from old.banned_at
      or new.banned_reason is distinct from old.banned_reason
      or new.banned_by is distinct from old.banned_by then
      raise exception 'Forbidden profile security field update.';
    end if;
  end if;

  new.id := old.id;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_privilege_escalation on public.profiles;
create trigger profiles_prevent_privilege_escalation
before update on public.profiles
for each row execute function public.prevent_profile_privilege_escalation();

-- ------------------------------------------------------------
-- Messages: users cannot edit/delete other users' messages
-- ------------------------------------------------------------

alter table public.messages enable row level security;

drop policy if exists "msg_update_participants_v2" on public.messages;
drop policy if exists "messages_update_sender_only" on public.messages;
create policy "messages_update_sender_only"
  on public.messages
  for update
  using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id);

drop policy if exists "Mesaj yazarı silebilir" on public.messages;
drop policy if exists "messages_delete_sender_only" on public.messages;
create policy "messages_delete_sender_only"
  on public.messages
  for delete
  using (auth.uid() = sender_id);

-- Modern chat table: prevent arbitrary participant insertion.
alter table public.conversation_participants enable row level security;
drop policy if exists "cp_insert_self" on public.conversation_participants;
drop policy if exists "cp_insert_service_role_only" on public.conversation_participants;
create policy "cp_insert_service_role_only"
  on public.conversation_participants
  for insert
  with check (auth.role() = 'service_role');

-- ------------------------------------------------------------
-- Storage hardening
-- ------------------------------------------------------------

alter table storage.objects enable row level security;

create or replace function public.can_access_message_media_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_first_segment text;
  v_conversation_id uuid;
begin
  if v_uid is null then
    return false;
  end if;

  v_first_segment := split_part(coalesce(p_name, ''), '/', 1);

  if v_first_segment = '' then
    return false;
  end if;

  -- legacy user-scoped path support: <uid>/file
  if v_first_segment = v_uid::text then
    return true;
  end if;

  -- conversation-scoped path support: <conversation_uuid>/file
  if v_first_segment ~* '^[0-9a-f-]{36}$' then
    v_conversation_id := v_first_segment::uuid;

    return exists (
      select 1
      from public.conversations c
      where c.id = v_conversation_id
        and (c.buyer_id = v_uid or c.seller_id = v_uid)
    )
    or exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = v_conversation_id
        and cp.user_id = v_uid
    );
  end if;

  return false;
end;
$$;

-- Tighten listing/story/store upload policies to owner-only writes.
drop policy if exists "Giriş yapan ilan görseli yükler" on storage.objects;
drop policy if exists "listing_images_insert_owner_only" on storage.objects;
create policy "listing_images_insert_owner_only"
  on storage.objects
  for insert
  with check (
    bucket_id = 'listing-images'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "listing_images_update_owner_only" on storage.objects;
create policy "listing_images_update_owner_only"
  on storage.objects
  for update
  using (
    bucket_id = 'listing-images'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'listing-images'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "listing_images_delete_owner_only" on storage.objects;
create policy "listing_images_delete_owner_only"
  on storage.objects
  for delete
  using (
    bucket_id = 'listing-images'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "Mağaza sahibi banner yükler" on storage.objects;
drop policy if exists "store_banners_insert_owner_only" on storage.objects;
create policy "store_banners_insert_owner_only"
  on storage.objects
  for insert
  with check (
    bucket_id = 'store-banners'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "store_banners_update_owner_only" on storage.objects;
create policy "store_banners_update_owner_only"
  on storage.objects
  for update
  using (
    bucket_id = 'store-banners'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'store-banners'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "store_banners_delete_owner_only" on storage.objects;
create policy "store_banners_delete_owner_only"
  on storage.objects
  for delete
  using (
    bucket_id = 'store-banners'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "Giriş yapan hikaye yükler" on storage.objects;
drop policy if exists "story_images_insert_owner_only" on storage.objects;
create policy "story_images_insert_owner_only"
  on storage.objects
  for insert
  with check (
    bucket_id = 'story-images'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "story_images_update_owner_only" on storage.objects;
create policy "story_images_update_owner_only"
  on storage.objects
  for update
  using (
    bucket_id = 'story-images'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'story-images'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "story_images_delete_owner_only" on storage.objects;
create policy "story_images_delete_owner_only"
  on storage.objects
  for delete
  using (
    bucket_id = 'story-images'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
  );

-- Replace legacy loose message media policies.
drop policy if exists "Konuşma tarafı dosya okur" on storage.objects;
drop policy if exists "Giriş yapan mesaj dosyası yükler" on storage.objects;
drop policy if exists "message_images_select_auth" on storage.objects;
drop policy if exists "message_images_insert_auth" on storage.objects;

drop policy if exists "message_files_select_participant_only" on storage.objects;
create policy "message_files_select_participant_only"
  on storage.objects
  for select
  using (
    bucket_id = 'message-files'
    and public.can_access_message_media_object(name)
  );

drop policy if exists "message_files_insert_participant_owner" on storage.objects;
create policy "message_files_insert_participant_owner"
  on storage.objects
  for insert
  with check (
    bucket_id = 'message-files'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
    and public.can_access_message_media_object(name)
  );

drop policy if exists "message_files_update_owner_only" on storage.objects;
create policy "message_files_update_owner_only"
  on storage.objects
  for update
  using (
    bucket_id = 'message-files'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
    and public.can_access_message_media_object(name)
  )
  with check (
    bucket_id = 'message-files'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
    and public.can_access_message_media_object(name)
  );

drop policy if exists "message_files_delete_owner_only" on storage.objects;
create policy "message_files_delete_owner_only"
  on storage.objects
  for delete
  using (
    bucket_id = 'message-files'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
    and public.can_access_message_media_object(name)
  );

drop policy if exists "message_images_select_participant_only" on storage.objects;
create policy "message_images_select_participant_only"
  on storage.objects
  for select
  using (
    bucket_id = 'message-images'
    and public.can_access_message_media_object(name)
  );

drop policy if exists "message_images_insert_participant_owner" on storage.objects;
create policy "message_images_insert_participant_owner"
  on storage.objects
  for insert
  with check (
    bucket_id = 'message-images'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
    and public.can_access_message_media_object(name)
  );

drop policy if exists "message_images_update_owner_only" on storage.objects;
create policy "message_images_update_owner_only"
  on storage.objects
  for update
  using (
    bucket_id = 'message-images'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
    and public.can_access_message_media_object(name)
  )
  with check (
    bucket_id = 'message-images'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
    and public.can_access_message_media_object(name)
  );

drop policy if exists "message_images_delete_own" on storage.objects;
drop policy if exists "message_images_delete_owner_only" on storage.objects;
create policy "message_images_delete_owner_only"
  on storage.objects
  for delete
  using (
    bucket_id = 'message-images'
    and auth.uid() is not null
    and (
      owner = auth.uid()
      or auth.uid()::text = (storage.foldername(name))[1]
    )
    and public.can_access_message_media_object(name)
  );

-- Explicit anon delete lock (tables + storage)
revoke delete on all tables in schema public from anon;
revoke delete on storage.objects from anon;
alter default privileges in schema public revoke delete on tables from anon;
