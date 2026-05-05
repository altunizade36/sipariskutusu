-- Reports audit trail: immutable action history for submission and moderation transitions.

create table if not exists public.report_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null check (action_type in ('submitted', 'reviewed', 'resolved', 'rejected')),
  previous_status text check (previous_status in ('pending', 'reviewed', 'resolved', 'rejected')),
  next_status text not null check (next_status in ('pending', 'reviewed', 'resolved', 'rejected')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists report_actions_report_created_idx
  on public.report_actions(report_id, created_at desc);
create index if not exists report_actions_actor_created_idx
  on public.report_actions(actor_id, created_at desc);

alter table public.report_actions enable row level security;

drop policy if exists "Report actions admin read" on public.report_actions;
create policy "Report actions admin read"
on public.report_actions
for select
using (public.is_admin_profile(auth.uid()));

revoke all on table public.report_actions from anon;
revoke all on table public.report_actions from authenticated;
grant select on table public.report_actions to authenticated;

-- Backfill one action row for existing reports if missing.
insert into public.report_actions (report_id, actor_id, action_type, previous_status, next_status, note, created_at)
select
  r.id,
  r.reporter_id,
  'submitted',
  null,
  'pending',
  'Initial report submission',
  r.created_at
from public.reports r
where not exists (
  select 1 from public.report_actions ra where ra.report_id = r.id
);

-- Re-create submit_report so every report has an initial action entry.
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

  insert into public.report_actions (
    report_id,
    actor_id,
    action_type,
    previous_status,
    next_status,
    note
  ) values (
    v_report_id,
    v_reporter_id,
    'submitted',
    null,
    'pending',
    coalesce(v_description, 'Initial report submission')
  );

  return v_report_id;
end;
$$;

-- Re-create review function with action logging and reporter notification.
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
  v_reporter_id uuid;
  v_target_type text;
  v_target_id uuid;
  v_reason text;
  v_previous_status text := 'pending';
  v_status_label text;
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
    and r.status = 'pending'
  returning r.reporter_id, r.target_type, r.target_id, r.reason
  into v_reporter_id, v_target_type, v_target_id, v_reason;

  if not found then
    raise exception 'İncelenecek bekleyen şikayet bulunamadı.';
  end if;

  insert into public.report_actions (
    report_id,
    actor_id,
    action_type,
    previous_status,
    next_status,
    note
  ) values (
    p_report_id,
    v_admin_id,
    p_status,
    v_previous_status,
    p_status,
    v_note
  );

  v_status_label := case p_status
    when 'reviewed' then 'İncelendi'
    when 'resolved' then 'Çözüldü'
    else 'Reddedildi'
  end;

  if to_regclass('public.notifications') is not null then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      v_reporter_id,
      'system',
      'Şikayet güncellendi',
      format('Şikayetiniz değerlendirildi: %s (%s)', v_status_label, coalesce(v_reason, 'Genel')),
      jsonb_build_object(
        'report_id', p_report_id,
        'status', p_status,
        'target_type', v_target_type,
        'target_id', v_target_id,
        'review_note', v_note
      )
    );
  end if;
end;
$$;

create or replace function public.fetch_report_actions_admin(
  p_report_id uuid,
  p_limit integer default 50
)
returns table (
  id uuid,
  report_id uuid,
  actor_id uuid,
  action_type text,
  previous_status text,
  next_status text,
  note text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
begin
  if v_admin_id is null then
    raise exception 'Giriş yapmanız gerekiyor.';
  end if;

  if not public.is_admin_profile(v_admin_id) then
    raise exception 'Bu işlem sadece admin kullanicilar için yetkilidir.';
  end if;

  return query
  select
    ra.id,
    ra.report_id,
    ra.actor_id,
    ra.action_type,
    ra.previous_status,
    ra.next_status,
    ra.note,
    ra.created_at
  from public.report_actions ra
  where ra.report_id = p_report_id
  order by ra.created_at desc
  limit v_limit;
end;
$$;

revoke all on function public.fetch_report_actions_admin(uuid, integer) from public;
revoke all on function public.fetch_report_actions_admin(uuid, integer) from anon;
grant execute on function public.fetch_report_actions_admin(uuid, integer) to authenticated;

revoke all on function public.submit_report(text, uuid, text, text) from public;
revoke all on function public.submit_report(text, uuid, text, text) from anon;
grant execute on function public.submit_report(text, uuid, text, text) to authenticated;

revoke all on function public.review_report_admin(uuid, text, text) from public;
revoke all on function public.review_report_admin(uuid, text, text) from anon;
grant execute on function public.review_report_admin(uuid, text, text) to authenticated;
