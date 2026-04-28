-- Push token lifecycle hardening for Expo + FCM/APNS/WebPush.

alter table public.user_push_tokens
  add column if not exists device_id text;

alter table public.user_push_tokens
  add column if not exists app_version text;

alter table public.user_push_tokens
  add column if not exists last_registered_at timestamptz;

create index if not exists user_push_tokens_user_provider_active_idx
  on public.user_push_tokens(user_id, provider, is_active, updated_at desc);

create index if not exists user_push_tokens_device_idx
  on public.user_push_tokens(device_id)
  where device_id is not null;

create or replace function public.register_my_push_token(
  p_token text,
  p_provider text default 'expo',
  p_platform text default 'android',
  p_device_id text default null,
  p_app_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_provider text := lower(trim(coalesce(p_provider, 'expo')));
  v_platform text := lower(trim(coalesce(p_platform, 'android')));
  v_token text := trim(coalesce(p_token, ''));
  v_device_id text := nullif(trim(coalesce(p_device_id, '')), '');
  v_app_version text := nullif(trim(coalesce(p_app_version, '')), '');
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Giriş yapmanız gerekiyor.';
  end if;

  if v_token = '' then
    raise exception 'Push token zorunludur.';
  end if;

  if v_provider not in ('expo', 'fcm', 'apns', 'webpush') then
    raise exception 'Gecersiz push provider.';
  end if;

  if v_platform not in ('ios', 'android', 'web') then
    raise exception 'Gecersiz platform.';
  end if;

  insert into public.user_push_tokens (
    user_id,
    token,
    platform,
    provider,
    device_id,
    app_version,
    is_active,
    failure_count,
    last_error,
    last_seen_at,
    last_registered_at,
    updated_at
  )
  values (
    v_user_id,
    v_token,
    v_platform,
    v_provider,
    v_device_id,
    v_app_version,
    true,
    0,
    null,
    now(),
    now(),
    now()
  )
  on conflict (user_id, token)
  do update set
    platform = excluded.platform,
    provider = excluded.provider,
    device_id = excluded.device_id,
    app_version = excluded.app_version,
    is_active = true,
    failure_count = 0,
    last_error = null,
    last_seen_at = now(),
    last_registered_at = now(),
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.unregister_my_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text := trim(coalesce(p_token, ''));
begin
  if v_user_id is null then
    raise exception 'Giriş yapmanız gerekiyor.';
  end if;

  if v_token = '' then
    raise exception 'Push token zorunludur.';
  end if;

  update public.user_push_tokens
  set
    is_active = false,
    updated_at = now(),
    last_seen_at = now()
  where user_id = v_user_id
    and token = v_token;

  if not found then
    raise exception 'Push token kaydi bulunamadi.';
  end if;
end;
$$;

create or replace function public.unregister_all_my_push_tokens()
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

  update public.user_push_tokens
  set
    is_active = false,
    updated_at = now(),
    last_seen_at = now()
  where user_id = v_user_id
    and is_active = true;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.register_my_push_token(text, text, text, text, text) from public;
revoke all on function public.register_my_push_token(text, text, text, text, text) from anon;
grant execute on function public.register_my_push_token(text, text, text, text, text) to authenticated;

revoke all on function public.unregister_my_push_token(text) from public;
revoke all on function public.unregister_my_push_token(text) from anon;
grant execute on function public.unregister_my_push_token(text) to authenticated;

revoke all on function public.unregister_all_my_push_tokens() from public;
revoke all on function public.unregister_all_my_push_tokens() from anon;
grant execute on function public.unregister_all_my_push_tokens() to authenticated;
