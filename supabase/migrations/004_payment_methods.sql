create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'iyzico')),
  type text not null check (type in ('card', 'wallet', 'bank_transfer', 'cash_on_delivery')),
  brand text,
  last4 text,
  holder_name text,
  expiry text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists payment_methods_user_idx on public.payment_methods(user_id);
create index if not exists payment_methods_default_idx on public.payment_methods(user_id, is_default);

alter table public.payment_methods enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'payment_methods' and policyname = 'Kendi payment methodlarini yonetir'
  ) then
    create policy "Kendi payment methodlarini yonetir" on public.payment_methods
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
