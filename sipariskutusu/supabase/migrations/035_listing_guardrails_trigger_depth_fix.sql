-- Allow system-triggered listing updates (e.g. like counter) without seller ownership checks.

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

      new.status := 'pending';
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.rejection_reason := null;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Updates originating from other triggers (like_count sync, etc.)
    -- should not be blocked by seller ownership checks.
    if pg_trigger_depth() > 1 then
      return new;
    end if;

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

      if new.status in ('active', 'rejected') and new.status is distinct from old.status then
        raise exception 'Listing status requires admin review.';
      end if;

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
