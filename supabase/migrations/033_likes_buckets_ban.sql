-- =============================================================
-- Migration 033: likes tablosu, doğru bucket isimleri, kullanıcı ban
-- =============================================================

-- ─── 1. LIKES TABLOSU ────────────────────────────────────────
-- İlan beğeni sistemi (favorites'tan ayrı, anlık "kalp" aksiyonu)
create table if not exists public.likes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  listing_id  uuid not null references public.listings (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint likes_unique unique (user_id, listing_id)
);

alter table public.likes enable row level security;

create policy "likes_select_public" on public.likes
  for select using (true);

create policy "likes_insert_own" on public.likes
  for insert with check (auth.uid() = user_id);

create policy "likes_delete_own" on public.likes
  for delete using (auth.uid() = user_id);

-- Beğeni sayacı için index
create index if not exists likes_listing_id_idx on public.likes (listing_id);
create index if not exists likes_user_id_idx     on public.likes (user_id);

-- Listing'e like_count kolonu ekle (yoksa)
alter table public.listings
  add column if not exists like_count integer not null default 0;

-- Beğeni sayacını güncel tutan trigger
create or replace function public.update_listing_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.listings set like_count = like_count + 1 where id = new.listing_id;
  elsif tg_op = 'DELETE' then
    update public.listings set like_count = greatest(like_count - 1, 0) where id = old.listing_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_likes_count on public.likes;
create trigger trg_likes_count
  after insert or delete on public.likes
  for each row execute function public.update_listing_like_count();

-- ─── 2. STORAGE BUCKET'LARI (spec isimleri) ──────────────────
-- Spec: listing-images, profile-images, message-images
-- Mevcut: listing-images ✅ | avatars (profile-images'a ek), message-files (message-images'a ek)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-images', 'profile-images', true,  2097152,
   array['image/jpeg','image/png','image/webp']),
  ('message-images', 'message-images', false, 10485760,
   array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- profile-images RLS
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'profile_images_select_public'
  ) then
    execute 'create policy "profile_images_select_public" on storage.objects for select using (bucket_id = ''profile-images'')';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'profile_images_insert_own'
  ) then
    execute 'create policy "profile_images_insert_own" on storage.objects for insert with check (bucket_id = ''profile-images'' and auth.uid()::text = (storage.foldername(name))[1])';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'profile_images_update_own'
  ) then
    execute 'create policy "profile_images_update_own" on storage.objects for update using (bucket_id = ''profile-images'' and auth.uid()::text = (storage.foldername(name))[1])';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'profile_images_delete_own'
  ) then
    execute 'create policy "profile_images_delete_own" on storage.objects for delete using (bucket_id = ''profile-images'' and auth.uid()::text = (storage.foldername(name))[1])';
  end if;
end $$;

-- message-images RLS
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'message_images_select_auth'
  ) then
    execute 'create policy "message_images_select_auth" on storage.objects for select using (bucket_id = ''message-images'' and auth.uid() is not null)';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'message_images_insert_auth'
  ) then
    execute 'create policy "message_images_insert_auth" on storage.objects for insert with check (bucket_id = ''message-images'' and auth.uid() is not null)';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'message_images_delete_own'
  ) then
    execute 'create policy "message_images_delete_own" on storage.objects for delete using (bucket_id = ''message-images'' and auth.uid()::text = (storage.foldername(name))[1])';
  end if;
end $$;

-- ─── 3. KULLANICI BAN SİSTEMİ ────────────────────────────────
-- profiles tablosuna is_banned kolonu ekle
alter table public.profiles
  add column if not exists is_banned        boolean not null default false,
  add column if not exists banned_at        timestamptz,
  add column if not exists banned_reason    text,
  add column if not exists banned_by        uuid references public.profiles (id);

-- Ban edilmiş kullanıcı yeni ilan açamaz (trigger)
create or replace function public.check_user_not_banned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_banned boolean;
  v_owner_id uuid;
begin
  -- listings tablosu seller_id veya user_id kullanabilir
  v_owner_id := coalesce(
    case when tg_table_name = 'listings' then new.seller_id else null end,
    new.user_id
  );
  select is_banned into v_banned from public.profiles where id = v_owner_id;
  if v_banned then
    raise exception 'Hesabınız askıya alınmıştır.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_listing_ban_check on public.listings;
create trigger trg_listing_ban_check
  before insert on public.listings
  for each row execute function public.check_user_not_banned();

-- Admin: kullanıcı ban fonksiyonu
create or replace function public.ban_user_admin(
  p_user_id uuid,
  p_reason  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  -- Sadece admin rolü çağırabilir
  select role into v_role from public.profiles where id = auth.uid();
  if v_role <> 'admin' then
    raise exception 'Yetkisiz erişim.' using errcode = 'P0001';
  end if;

  update public.profiles
  set
    is_banned     = true,
    banned_at     = now(),
    banned_reason = p_reason,
    banned_by     = auth.uid()
  where id = p_user_id;

  if not found then
    raise exception 'Kullanıcı bulunamadı.' using errcode = 'P0002';
  end if;
end;
$$;

-- Admin: ban kaldır
create or replace function public.unban_user_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role <> 'admin' then
    raise exception 'Yetkisiz erişim.' using errcode = 'P0001';
  end if;

  update public.profiles
  set
    is_banned     = false,
    banned_at     = null,
    banned_reason = null,
    banned_by     = null
  where id = p_user_id;
end;
$$;

revoke all on function public.ban_user_admin(uuid, text) from public, anon;
grant execute on function public.ban_user_admin(uuid, text) to authenticated;

revoke all on function public.unban_user_admin(uuid) from public, anon;
grant execute on function public.unban_user_admin(uuid) to authenticated;

-- ─── 4. ADMIN: PENDİNG İLAN LİSTESİ (web panel için) ─────────
create or replace function public.get_pending_listings_admin(
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  id           uuid,
  title        text,
  price        numeric,
  status       text,
  created_at   timestamptz,
  user_id      uuid,
  user_name    text,
  cover_url    text
)
language sql
security definer
set search_path = public
as $$
  select
    l.id,
    l.title,
    l.price,
    l.status,
    l.created_at,
    l.seller_id as user_id,
    coalesce(p.full_name, 'Anonim') as user_name,
    (select url from listing_images where listing_id = l.id and is_cover = true limit 1) as cover_url
  from listings l
  left join profiles p on p.id = l.seller_id
  where l.status = 'pending'
  order by l.created_at asc
  limit p_limit offset p_offset;
$$;

-- Admin: bekleyen şikayetler listesi
create or replace function public.get_open_reports_admin(
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  id            uuid,
  target_type   text,
  target_id     uuid,
  reason        text,
  status        text,
  created_at    timestamptz,
  reporter_name text
)
language sql
security definer
set search_path = public
as $$
  select
    r.id,
    r.target_type,
    r.target_id,
    r.reason,
    r.status,
    r.created_at,
    coalesce(p.full_name, 'Anonim') as reporter_name
  from reports r
  left join profiles p on p.id = r.reporter_id
  where r.status = 'pending'
  order by r.created_at asc
  limit p_limit offset p_offset;
$$;

revoke all on function public.get_pending_listings_admin(integer, integer) from public, anon;
grant execute on function public.get_pending_listings_admin(integer, integer) to authenticated;

revoke all on function public.get_open_reports_admin(integer, integer) from public, anon;
grant execute on function public.get_open_reports_admin(integer, integer) to authenticated;
