-- Reduce listing media count limit from 8 to 5 while preserving cover normalization.

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

  if media_count >= 5 then
    raise exception 'Maksimum 5 medya yukleyebilirsiniz.';
  end if;

  if not exists (
    select 1
    from public.listing_images li
    where li.listing_id = new.listing_id
      and (tg_op <> 'UPDATE' or li.id <> new.id)
  ) then
    new.is_cover := true;
    if new.sort_order is null or new.sort_order <> 0 then
      new.sort_order := 0;
    end if;
  end if;

  return new;
end;
$$;