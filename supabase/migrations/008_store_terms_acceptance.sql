-- Store Terms and Conditions Acceptance Tracking
create table if not exists store_terms_acceptance (
  id uuid primary key default gen_random_uuid(),
  store_id uuid unique not null references stores(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  
  -- Acceptance flags
  accepted_terms_of_service boolean not null default false,
  accepted_privacy_policy boolean not null default false,
  accepted_kvkk boolean not null default false,
  accepted_platform_liability boolean not null default false,
  
  -- All flags must be true to create store
  all_accepted boolean generated always as (
    accepted_terms_of_service and accepted_privacy_policy and 
    accepted_kvkk and accepted_platform_liability
  ) stored,
  
  -- IP and device info for compliance
  accepted_ip_address text,
  accepted_user_agent text,
  
  -- Timestamps
  accepted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for quick lookups
create index if not exists store_terms_acceptance_store_idx on store_terms_acceptance(store_id);
create index if not exists store_terms_acceptance_seller_idx on store_terms_acceptance(seller_id);

-- Update timestamp trigger
create or replace function update_store_terms_acceptance_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists store_terms_acceptance_timestamp_trigger on store_terms_acceptance;
create trigger store_terms_acceptance_timestamp_trigger
before update on store_terms_acceptance
for each row
execute function update_store_terms_acceptance_timestamp();

create or replace function validate_store_terms_owner_compat()
returns trigger as $$
declare
  v_store_seller uuid;
begin
  select seller_id into v_store_seller from stores where id = new.store_id;

  if v_store_seller is null then
    raise exception 'Store not found for terms acceptance';
  end if;

  if new.seller_id <> v_store_seller then
    raise exception 'seller_id must match stores.seller_id';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists validate_store_terms_owner_trigger on store_terms_acceptance;
create trigger validate_store_terms_owner_trigger
before insert or update on store_terms_acceptance
for each row
execute function validate_store_terms_owner_compat();

-- RLS Policies
alter table store_terms_acceptance enable row level security;

create policy "Sellers can view their own terms acceptance"
  on store_terms_acceptance for select
  using (auth.uid() = seller_id);

create policy "Sellers can insert their own terms acceptance"
  on store_terms_acceptance for insert
  with check (auth.uid() = seller_id);

create policy "Sellers can update their own terms acceptance"
  on store_terms_acceptance for update
  using (auth.uid() = seller_id);
