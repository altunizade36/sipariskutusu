-- Centralized reports system for listing/user/comment moderation workflows.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('listing', 'user', 'comment')),
  target_id uuid not null,
  reason text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'resolved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text
);

create index if not exists reports_status_created_idx
  on public.reports(status, created_at desc);
create index if not exists reports_reporter_created_idx
  on public.reports(reporter_id, created_at desc);
create index if not exists reports_target_lookup_idx
  on public.reports(target_type, target_id, status, created_at desc);

alter table public.reports enable row level security;

drop policy if exists "Reports select own or admin" on public.reports;
create policy "Reports select own or admin"
on public.reports
for select
using (
  auth.uid() = reporter_id
  or public.is_admin_profile(auth.uid())
);

revoke all on table public.reports from anon;
revoke all on table public.reports from authenticated;
grant select on table public.reports to authenticated;

create or replace function public.report_target_exists(
  p_target_type text,
  p_target_id uuid
)
returns boolean
language plpgsql
stable
set search_path = public
as $$
begin
  if p_target_type = 'listing' then
    return exists(select 1 from public.listings l where l.id = p_target_id);
  elsif p_target_type = 'user' then
    return exists(select 1 from public.profiles p where p.id = p_target_id);
  elsif p_target_type = 'comment' then
    return exists(select 1 from public.listing_comments c where c.id = p_target_id);
  end if;

  return false;
end;
$$;

create or replace function public.submit_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter_id uuid := auth.uid();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_report_id uuid;
begin
  if v_reporter_id is null then
    raise exception 'Giriş yapmanız gerekiyor.';
  end if;

  if p_target_type not in ('listing', 'user', 'comment') then
    raise exception 'Geçersiz şikayet hedefi.';
  end if;

  if p_target_id is null then
    raise exception 'Şikayet hedefi boş olamaz.';
  end if;

  if v_reason is null then
    raise exception 'Şikayet nedeni zorunludur.';
  end if;

  if char_length(v_reason) < 3 or char_length(v_reason) > 120 then
    raise exception 'Şikayet nedeni 3-120 karakter arasında olmalıdır.';
  end if;

  if v_description is not null and char_length(v_description) > 1000 then
    raise exception 'Şikayet açıklaması 1000 karakteri geçemez.';
  end if;

  if not public.report_target_exists(p_target_type, p_target_id) then
    raise exception 'Şikayet edilecek hedef bulunamadı.';
  end if;

  if p_target_type = 'user' and p_target_id = v_reporter_id then
    raise exception 'Kendinizi şikayet edemezsiniz.';
  end if;

  if exists (
    select 1
    from public.reports r
    where r.reporter_id = v_reporter_id
      and r.target_type = p_target_type
      and r.target_id = p_target_id
      and r.status = 'pending'
      and r.created_at >= now() - interval '24 hours'
  ) then
    raise exception 'Aynı hedef için son 24 saatte zaten şikayet oluşturdunuz.';
  end if;

  insert into public.reports (
    reporter_id,
    target_type,
    target_id,
    reason,
    description,
    status
  ) values (
    v_reporter_id,
    p_target_type,
    p_target_id,
    v_reason,
    v_description,
    'pending'
  )
  returning id into v_report_id;

  return v_report_id;
end;
$$;

create or replace function public.review_report_admin(
  p_report_id uuid,
  p_status text,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_note text := nullif(trim(coalesce(p_review_note, '')), '');
begin
  if v_admin_id is null then
    raise exception 'Giriş yapmanız gerekiyor.';
  end if;

  if not public.is_admin_profile(v_admin_id) then
    raise exception 'Bu işlem sadece admin kullanicilar için yetkilidir.';
  end if;

  if p_status not in ('reviewed', 'resolved', 'rejected') then
    raise exception 'Geçersiz şikayet durum kararı.';
  end if;

  update public.reports r
  set
    status = p_status,
    reviewed_by = v_admin_id,
    reviewed_at = now(),
    review_note = v_note
  where r.id = p_report_id
    and r.status = 'pending';

  if not found then
    raise exception 'İncelenecek bekleyen şikayet bulunamadı.';
  end if;
end;
$$;

create or replace function public.fetch_pending_reports_admin(
  p_limit integer default 100
)
returns table (
  id uuid,
  reporter_id uuid,
  target_type text,
  target_id uuid,
  reason text,
  description text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
begin
  if v_admin_id is null then
    raise exception 'Giriş yapmanız gerekiyor.';
  end if;

  if not public.is_admin_profile(v_admin_id) then
    raise exception 'Bu işlem sadece admin kullanicilar için yetkilidir.';
  end if;

  return query
  select
    r.id,
    r.reporter_id,
    r.target_type,
    r.target_id,
    r.reason,
    r.description,
    r.status,
    r.created_at
  from public.reports r
  where r.status = 'pending'
  order by r.created_at asc
  limit v_limit;
end;
$$;

revoke all on function public.submit_report(text, uuid, text, text) from public;
revoke all on function public.submit_report(text, uuid, text, text) from anon;
revoke all on function public.review_report_admin(uuid, text, text) from public;
revoke all on function public.review_report_admin(uuid, text, text) from anon;
revoke all on function public.fetch_pending_reports_admin(integer) from public;
revoke all on function public.fetch_pending_reports_admin(integer) from anon;

grant execute on function public.submit_report(text, uuid, text, text) to authenticated;
grant execute on function public.review_report_admin(uuid, text, text) to authenticated;
grant execute on function public.fetch_pending_reports_admin(integer) to authenticated;
