-- Strong DB-side moderation enforcement for listings and moderation audits.

create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = user_id
      and p.role = 'admin'
  );
$$;

grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to anon;

-- Replace legacy broad seller policy that allowed FOR ALL writes.
drop policy if exists "Satici kendi ilanlarini yonetir" on public.listings;
drop policy if exists "Satıcı kendi ilanlarını yönetir" on public.listings;

-- Seller-specific granular policies.
drop policy if exists "listings_seller_select_own" on public.listings;
create policy "listings_seller_select_own"
  on public.listings
  for select
  using (auth.uid() = seller_id);

drop policy if exists "listings_seller_insert_pending" on public.listings;
create policy "listings_seller_insert_pending"
  on public.listings
  for insert
  with check (
    auth.uid() = seller_id
    and status = 'pending'
  );

drop policy if exists "listings_seller_update_guarded" on public.listings;
create policy "listings_seller_update_guarded"
  on public.listings
  for update
  using (auth.uid() = seller_id)
  with check (
    auth.uid() = seller_id
    and status in ('pending', 'sold', 'deleted')
  );

drop policy if exists "listings_seller_delete_own" on public.listings;
create policy "listings_seller_delete_own"
  on public.listings
  for delete
  using (auth.uid() = seller_id);

-- Admin queue/review access policies.
drop policy if exists "listings_admin_select_all" on public.listings;
create policy "listings_admin_select_all"
  on public.listings
  for select
  using (public.is_admin(auth.uid()));

drop policy if exists "listings_admin_update_all" on public.listings;
create policy "listings_admin_update_all"
  on public.listings
  for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create or replace function public.enforce_listing_moderation_guardrails()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin_user boolean;
  changed_sensitive_content boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  is_admin_user := public.is_admin(auth.uid());

  if tg_op = 'INSERT' then
    if not is_admin_user then
      if new.seller_id is distinct from auth.uid() then
        raise exception 'Cannot create listing for another seller.';
      end if;

      -- Seller-created listings always start in pending moderation.
      new.status := 'pending';
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.rejection_reason := null;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    changed_sensitive_content := (
      new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.price is distinct from old.price
      or new.category_id is distinct from old.category_id
    );

    if not is_admin_user then
      if old.seller_id is distinct from auth.uid() then
        raise exception 'Only listing owner can update this listing.';
      end if;

      -- Seller cannot self-approve or self-reject.
      if new.status in ('active', 'rejected') and new.status is distinct from old.status then
        raise exception 'Listing status requires admin review.';
      end if;

      -- Any sensitive content change on active listing forces re-review.
      if old.status = 'active' and changed_sensitive_content then
        new.status := 'pending';
      end if;

      if new.status = 'pending' then
        new.reviewed_by := null;
        new.reviewed_at := null;
        new.rejection_reason := null;
      end if;

      return new;
    end if;

    -- Admin review metadata normalization.
    if old.status = 'pending' and new.status in ('active', 'rejected') then
      if new.reviewed_by is null then
        new.reviewed_by := auth.uid();
      end if;
      if new.reviewed_at is null then
        new.reviewed_at := now();
      end if;
      if new.status = 'active' then
        new.rejection_reason := null;
      end if;
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists listings_moderation_guardrails on public.listings;
create trigger listings_moderation_guardrails
before insert or update on public.listings
for each row execute function public.enforce_listing_moderation_guardrails();

create or replace function public.enforce_moderation_audit_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin_user boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  is_admin_user := public.is_admin(auth.uid());

  if new.trigger_type = 'manual_review' then
    if not is_admin_user then
      raise exception 'Only admins can write manual review audits.';
    end if;

    if new.review_decision not in ('active', 'rejected') then
      raise exception 'Manual review must include a valid review decision.';
    end if;

    new.reviewer_id := coalesce(new.reviewer_id, auth.uid());
    if new.reviewer_id is distinct from auth.uid() then
      raise exception 'Manual review reviewer_id must match current admin.';
    end if;
  else
    -- automated_precheck rows must not carry admin-only fields.
    if new.review_decision is not null or new.reviewer_id is not null then
      raise exception 'Automated audits cannot include manual reviewer fields.';
    end if;
  end if;

  if new.automated_status not in ('pass', 'flagged') then
    raise exception 'Invalid automated_status value.';
  end if;

  return new;
end;
$$;

drop trigger if exists listing_moderation_audits_integrity on public.listing_moderation_audits;
create trigger listing_moderation_audits_integrity
before insert or update on public.listing_moderation_audits
for each row execute function public.enforce_moderation_audit_integrity();

create or replace function public.review_listing_admin(
  p_listing_id uuid,
  p_decision text,
  p_review_note text default null
)
returns public.listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_listing public.listings;
  v_note text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.is_admin(v_user_id) then
    raise exception 'Only admins can review listings.';
  end if;

  if p_decision not in ('active', 'rejected') then
    raise exception 'Decision must be active or rejected.';
  end if;

  v_note := nullif(trim(coalesce(p_review_note, '')), '');

  update public.listings l
  set
    status = p_decision::public.listing_status,
    reviewed_by = v_user_id,
    reviewed_at = now(),
    rejection_reason = case
      when p_decision = 'rejected' then coalesce(v_note, 'Listing rejected by admin review.')
      else null
    end,
    updated_at = now()
  where l.id = p_listing_id
    and l.status = 'pending'
  returning l.* into v_listing;

  if not found then
    raise exception 'Pending listing not found for review.';
  end if;

  insert into public.listing_moderation_audits (
    listing_id,
    trigger_type,
    automated_status,
    checks_json,
    flagged_reasons,
    reviewer_id,
    review_decision,
    review_note
  )
  values (
    p_listing_id,
    'manual_review',
    'pass',
    jsonb_build_object(
      'manual_review',
      jsonb_build_object(
        'passed', true,
        'decision', p_decision,
        'reason', coalesce(v_note, 'Manual review completed.')
      )
    ),
    case
      when p_decision = 'rejected' then array[coalesce(v_note, 'Manual review rejection')]
      else '{}'::text[]
    end,
    v_user_id,
    p_decision,
    v_note
  );

  return v_listing;
end;
$$;

grant execute on function public.review_listing_admin(uuid, text, text) to authenticated;
