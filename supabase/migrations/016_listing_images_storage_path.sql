alter table if exists public.listing_images
  add column if not exists storage_path text;

update public.listing_images
set storage_path = regexp_replace(url, '^.*?/storage/v1/object/public/listing-images/', '')
where storage_path is null
  and url like '%/storage/v1/object/public/listing-images/%';

create index if not exists listing_images_storage_path_idx
  on public.listing_images(storage_path);
