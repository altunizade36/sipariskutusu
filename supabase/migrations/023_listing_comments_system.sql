-- Listing comments with moderation, author delete, and admin hide support.

alter table public.profiles
  add column if not exists is_comment_blocked boolean not null default false;

create table if not exists public.listing_comments (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid null references public.listing_comments(id) on delete cascade,
  comment text not null check (char_length(trim(comment)) > 0),
  status text not null default 'active' check (status in ('active', 'hidden', 'deleted')),
  created_at timestamptz not null default now()
);

create index if not exists listing_comments_listing_idx on public.listing_comments(listing_id, created_at);
create index if not exists listing_comments_user_idx on public.listing_comments(user_id, created_at desc);
create index if not exists listing_comments_parent_idx on public.listing_comments(parent_id);
create index if not exists listing_comments_status_idx on public.listing_comments(status);

alter table public.listing_comments enable row level security;

create or replace function public.is_admin_profile(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.role = 'admin'
  );
$$;

create or replace function public.normalize_comment_filter_text(p_text text)
returns text
language sql
immutable
as $$
  select lower(translate(coalesce(p_text, ''), 'ÇĞİIÖŞÜçğiıöşü', 'CGIIOSUcgiiosu'));
$$;

create or replace function public.comment_contains_blocked_terms(p_text text)
returns boolean
language plpgsql
immutable
as $$
declare
  normalized text := public.normalize_comment_filter_text(p_text);
  blocked_terms text[] := array[
    'salak', 'aptal', 'gerizekali', 'gerzek', 'mal', 'oc', 'o c', 'orospu', 'pic', 'pislik',
    'serefsiz', 'kahpe', 'ibne', 'amk', 'aq', 'mk', 'sg', 'siktir', 'sikik', 'yarrak',
    'uyusturucu', 'narkotik', 'kacak', 'calinti', 'sahte', 'tabanca', 'silah', 'bomba'
  ];
  term text;
begin
  foreach term in array blocked_terms
  loop
    if position(term in normalized) > 0 then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'listing_comments' and policyname = 'Listing comments active read'
  ) then
    create policy "Listing comments active read" on public.listing_comments
    for select using (status = 'active');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'listing_comments' and policyname = 'Listing comments own read'
  ) then
    create policy "Listing comments own read" on public.listing_comments
    for select using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'listing_comments' and policyname = 'Listing comments admin read'
  ) then
    create policy "Listing comments admin read" on public.listing_comments
    for select using (public.is_admin_profile(auth.uid()));
  end if;
end $$;

create or replace function public.add_listing_comment(
  p_listing_id uuid,
  p_comment text,
  p_parent_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_comment text := trim(coalesce(p_comment, ''));
  v_comment_id uuid;
  v_profile_blocked boolean := false;
  v_parent_listing_id uuid;
begin
  if v_user_id is null then
    raise exception 'Giriş yapmanız gerekiyor.';
  end if;

  if v_comment = '' then
    raise exception 'Yorum boş olamaz.';
  end if;

  select coalesce(p.is_comment_blocked, false)
  into v_profile_blocked
  from public.profiles p
  where p.id = v_user_id;

  if v_profile_blocked then
    raise exception 'Yorum yapma yetkiniz geçici olarak kapatılmış.';
  end if;

  if public.comment_contains_blocked_terms(v_comment) then
    raise exception 'Yorumunuz yasaklı ifadeler içeriyor.';
  end if;

  if not exists (
    select 1 from public.listings l
    where l.id = p_listing_id
      and l.status in ('active', 'pending', 'sold')
  ) then
    raise exception 'Yorum yapılacak ilan bulunamadı.';
  end if;

  if p_parent_id is not null then
    select lc.listing_id
    into v_parent_listing_id
    from public.listing_comments lc
    where lc.id = p_parent_id
      and lc.status = 'active';

    if v_parent_listing_id is null or v_parent_listing_id <> p_listing_id then
      raise exception 'Yanıtlanacak yorum geçersiz.';
    end if;
  end if;

  insert into public.listing_comments (listing_id, user_id, parent_id, comment, status)
  values (p_listing_id, v_user_id, p_parent_id, v_comment, 'active')
  returning id into v_comment_id;

  return v_comment_id;
end;
$$;

create or replace function public.delete_my_listing_comment(p_comment_id uuid)
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

  update public.listing_comments lc
  set status = 'deleted'
  where lc.id = p_comment_id
    and lc.user_id = v_user_id;

  if not found then
    raise exception 'Bu yorumu silme yetkiniz yok.';
  end if;
end;
$$;

create or replace function public.hide_listing_comment_admin(p_comment_id uuid)
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

  if not public.is_admin_profile(v_user_id) then
    raise exception 'Bu işlem sadece admin kullanicilar için yetkilidir.';
  end if;

  update public.listing_comments lc
  set status = 'hidden'
  where lc.id = p_comment_id;

  if not found then
    raise exception 'Gizlenecek yorum bulunamadı.';
  end if;
end;
$$;

grant execute on function public.add_listing_comment(uuid, text, uuid) to authenticated;
grant execute on function public.delete_my_listing_comment(uuid) to authenticated;
grant execute on function public.hide_listing_comment_admin(uuid) to authenticated;