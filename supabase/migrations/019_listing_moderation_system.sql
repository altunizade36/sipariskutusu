-- Listing moderation system: review fields + audit trail table.

alter table if exists public.listings
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

alter table if exists public.listings
  add column if not exists reviewed_at timestamptz;

alter table if exists public.listings
  add column if not exists rejection_reason text;

create table if not exists public.listing_moderation_audits (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  trigger_type text not null default 'automated_precheck' check (trigger_type in ('automated_precheck', 'manual_review')),
  automated_status text not null check (automated_status in ('pass', 'flagged')),
  checks_json jsonb not null default '{}'::jsonb,
  flagged_reasons text[] not null default '{}'::text[],
  reviewer_id uuid references public.profiles(id) on delete set null,
  review_decision text check (review_decision in ('active', 'rejected')),
  review_note text,
  created_at timestamptz not null default now()
);

create index if not exists listing_moderation_audits_listing_idx
  on public.listing_moderation_audits(listing_id, created_at desc);

create index if not exists listing_moderation_audits_status_idx
  on public.listing_moderation_audits(automated_status, created_at desc);

alter table public.listing_moderation_audits enable row level security;

drop policy if exists "listing_moderation_select_own_or_admin" on public.listing_moderation_audits;
create policy "listing_moderation_select_own_or_admin"
  on public.listing_moderation_audits
  for select
  using (
    exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.seller_id = auth.uid()
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "listing_moderation_insert_own_or_admin" on public.listing_moderation_audits;
create policy "listing_moderation_insert_own_or_admin"
  on public.listing_moderation_audits
  for insert
  with check (
    exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.seller_id = auth.uid()
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "listing_moderation_admin_update" on public.listing_moderation_audits;
create policy "listing_moderation_admin_update"
  on public.listing_moderation_audits
  for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );
