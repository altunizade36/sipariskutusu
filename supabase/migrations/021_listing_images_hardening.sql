-- Hardening listing media rules at DB level.

-- Keep max one cover image per listing.
create unique index if not exists listing_images_single_cover_idx
  on public.listing_images(listing_id)
  where is_cover = true;

create or replace function public.enforce_listing_images_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  media_count integer;
begin
  select count(*)
  into media_count
  from public.listing_images li
  where li.listing_id = new.listing_id
    and (tg_op <> 'UPDATE' or li.id <> new.id);

  if media_count >= 8 then
    raise exception 'Maksimum 8 medya yukleyebilirsiniz.';
  end if;

  if not exists (
    select 1
    from public.listing_images li
    where li.listing_id = new.listing_id
      and (tg_op <> 'UPDATE' or li.id <> new.id)
  ) then
    -- First media must always become cover.
    new.is_cover := true;
    if new.sort_order is null or new.sort_order <> 0 then
      new.sort_order := 0;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists listing_images_before_write_guard on public.listing_images;
create trigger listing_images_before_write_guard
before insert or update on public.listing_images
for each row execute function public.enforce_listing_images_before_write();

create or replace function public.normalize_listing_images_cover()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_listing_id uuid;
  keep_cover_id uuid;
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  target_listing_id := coalesce(new.listing_id, old.listing_id);
  if target_listing_id is null then
    return null;
  end if;

  select li.id
  into keep_cover_id
  from public.listing_images li
  where li.listing_id = target_listing_id
  order by li.is_cover desc, li.sort_order asc, li.created_at asc, li.id asc
  limit 1;

  if keep_cover_id is null then
    return null;
  end if;

  update public.listing_images li
  set is_cover = (li.id = keep_cover_id)
  where li.listing_id = target_listing_id
    and li.is_cover is distinct from (li.id = keep_cover_id);

  return null;
end;
$$;

drop trigger if exists listing_images_after_write_normalize_cover on public.listing_images;
create trigger listing_images_after_write_normalize_cover
after insert or update or delete on public.listing_images
for each row execute function public.normalize_listing_images_cover();
