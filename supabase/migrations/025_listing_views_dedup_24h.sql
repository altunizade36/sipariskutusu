-- Listing view tracking with 24-hour deduplication window.

create table if not exists public.listing_views (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid null references public.profiles(id) on delete set null,
  device_id text null,
  ip_hash text null,
  created_at timestamptz not null default now(),
  constraint listing_views_identity_check
    check (user_id is not null or device_id is not null or ip_hash is not null)
);

create index if not exists listing_views_listing_created_idx
  on public.listing_views(listing_id, created_at desc);
create index if not exists listing_views_listing_user_created_idx
  on public.listing_views(listing_id, user_id, created_at desc)
  where user_id is not null;
create index if not exists listing_views_listing_device_created_idx
  on public.listing_views(listing_id, device_id, created_at desc)
  where device_id is not null;
create index if not exists listing_views_listing_ip_created_idx
  on public.listing_views(listing_id, ip_hash, created_at desc)
  where ip_hash is not null;

alter table public.listing_views enable row level security;

create policy "Listing views read own or admin"
on public.listing_views
for select
using (
  auth.uid() = user_id
  or public.is_admin_profile(auth.uid())
);

revoke all on table public.listing_views from anon;
revoke all on table public.listing_views from authenticated;

grant select on table public.listing_views to authenticated;

create or replace function public.increment_view_count(
  listing_id uuid,
  p_device_id text default null,
  p_ip_hash text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cutoff timestamptz := now() - interval '24 hours';
  v_exists boolean := false;
begin
  if listing_id is null then
    return;
  end if;

  if not exists (select 1 from public.listings l where l.id = listing_id) then
    return;
  end if;

  if v_user_id is null and nullif(trim(coalesce(p_device_id, '')), '') is null and nullif(trim(coalesce(p_ip_hash, '')), '') is null then
    return;
  end if;

  select exists(
    select 1
    from public.listing_views lv
    where lv.listing_id = increment_view_count.listing_id
      and lv.created_at >= v_cutoff
      and (
        (v_user_id is not null and lv.user_id = v_user_id)
        or (v_user_id is null and p_device_id is not null and lv.device_id = p_device_id)
        or (v_user_id is null and p_device_id is null and p_ip_hash is not null and lv.ip_hash = p_ip_hash)
      )
  ) into v_exists;

  if v_exists then
    return;
  end if;

  insert into public.listing_views (listing_id, user_id, device_id, ip_hash)
  values (
    increment_view_count.listing_id,
    v_user_id,
    nullif(trim(coalesce(p_device_id, '')), ''),
    nullif(trim(coalesce(p_ip_hash, '')), '')
  );

  update public.listings
  set view_count = coalesce(view_count, 0) + 1
  where id = increment_view_count.listing_id;
end;
$$;

grant execute on function public.increment_view_count(uuid, text, text) to authenticated;
grant execute on function public.increment_view_count(uuid, text, text) to anon;
