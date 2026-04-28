-- Reports workflow hardening: admin analytics + reporter notification on decision.

create index if not exists reports_reason_status_idx
  on public.reports(reason, status, created_at desc);

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

create or replace function public.fetch_report_reason_stats_admin(
  p_days integer default 30,
  p_limit integer default 20
)
returns table (
  reason text,
  total_count bigint,
  pending_count bigint,
  reviewed_count bigint,
  resolved_count bigint,
  rejected_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
begin
  if v_admin_id is null then
    raise exception 'Giriş yapmanız gerekiyor.';
  end if;

  if not public.is_admin_profile(v_admin_id) then
    raise exception 'Bu işlem sadece admin kullanicilar için yetkilidir.';
  end if;

  return query
  select
    r.reason,
    count(*) as total_count,
    count(*) filter (where r.status = 'pending') as pending_count,
    count(*) filter (where r.status = 'reviewed') as reviewed_count,
    count(*) filter (where r.status = 'resolved') as resolved_count,
    count(*) filter (where r.status = 'rejected') as rejected_count
  from public.reports r
  where r.created_at >= now() - make_interval(days => v_days)
  group by r.reason
  order by total_count desc, r.reason asc
  limit v_limit;
end;
$$;

revoke all on function public.fetch_report_reason_stats_admin(integer, integer) from public;
revoke all on function public.fetch_report_reason_stats_admin(integer, integer) from anon;
grant execute on function public.fetch_report_reason_stats_admin(integer, integer) to authenticated;

revoke all on function public.review_report_admin(uuid, text, text) from public;
revoke all on function public.review_report_admin(uuid, text, text) from anon;
grant execute on function public.review_report_admin(uuid, text, text) to authenticated;
