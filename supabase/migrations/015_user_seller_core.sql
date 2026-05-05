-- Central buyer/seller role model and seller-profile synchronization.

alter table public.profiles
  add column if not exists role text;

alter table public.profiles
  add column if not exists is_seller boolean not null default false;

update public.profiles
set role = case when coalesce(is_seller, false) then 'seller' else 'buyer' end
where role is null;

alter table public.profiles
  alter column role set default 'buyer';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('buyer', 'seller', 'admin'));
  end if;
end $$;

create or replace function public.sync_profile_seller_role()
returns trigger
language plpgsql
as $$
begin
  update public.profiles
  set
    is_seller = true,
    role = case when role = 'admin' then role else 'seller' end,
    updated_at = now()
  where id = new.seller_id;

  return new;
end;
$$;

drop trigger if exists stores_sync_profile_seller_role on public.stores;
create trigger stores_sync_profile_seller_role
after insert on public.stores
for each row execute function public.sync_profile_seller_role();

create or replace function public.sync_profile_buyer_role()
returns trigger
language plpgsql
as $$
begin
  update public.profiles p
  set
    is_seller = exists (select 1 from public.stores s where s.seller_id = p.id and s.is_active = true),
    role = case
      when p.role = 'admin' then p.role
      when exists (select 1 from public.stores s where s.seller_id = p.id and s.is_active = true) then 'seller'
      else 'buyer'
    end,
    updated_at = now()
  where p.id = old.seller_id;

  return old;
end;
$$;

drop trigger if exists stores_delete_sync_profile_role on public.stores;
create trigger stores_delete_sync_profile_role
after delete on public.stores
for each row execute function public.sync_profile_buyer_role();