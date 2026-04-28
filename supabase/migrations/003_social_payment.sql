-- Social + payment hardening tables

create table if not exists public.store_follows (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(store_id, user_id)
);

create index if not exists store_follows_store_idx on public.store_follows(store_id);
create index if not exists store_follows_user_idx on public.store_follows(user_id);

create table if not exists public.story_views (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(story_id, user_id)
);

create index if not exists story_views_story_idx on public.story_views(story_id);
create index if not exists story_views_user_idx on public.story_views(user_id);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'iyzico')),
  order_reference text not null,
  external_tx_id text,
  amount numeric(12,2) not null,
  currency text not null default 'TRY',
  method text not null,
  status text not null check (status in ('authorized', 'captured', 'failed', 'refunded')),
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_transactions_user_idx on public.payment_transactions(user_id);
create index if not exists payment_transactions_order_ref_idx on public.payment_transactions(order_reference);

create or replace function public.increment_story_view_count(p_story_id uuid)
returns void language sql security definer as $$
  update public.stories set view_count = view_count + 1 where id = p_story_id;
$$;

create or replace function public.increment_store_followers(store_id uuid)
returns void language sql security definer as $$
  update public.stores set follower_count = follower_count + 1 where id = store_id;
$$;

create or replace function public.decrement_store_followers(store_id uuid)
returns void language sql security definer as $$
  update public.stores set follower_count = greatest(follower_count - 1, 0) where id = store_id;
$$;

alter table public.store_follows enable row level security;
alter table public.story_views enable row level security;
alter table public.payment_transactions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'store_follows' and policyname = 'Kendi takiplerini yonetir'
  ) then
    create policy "Kendi takiplerini yonetir" on public.store_follows
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'store_follows' and policyname = 'Store follow okumasi'
  ) then
    create policy "Store follow okumasi" on public.store_follows
    for select using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'story_views' and policyname = 'Kendi story goruntulemelerini yonetir'
  ) then
    create policy "Kendi story goruntulemelerini yonetir" on public.story_views
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'payment_transactions' and policyname = 'Kendi payment kaydini gorur'
  ) then
    create policy "Kendi payment kaydini gorur" on public.payment_transactions
    for select using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'payment_transactions' and policyname = 'Kendi payment kaydini ekler'
  ) then
    create policy "Kendi payment kaydini ekler" on public.payment_transactions
    for insert with check (auth.uid() = user_id);
  end if;
end $$;
