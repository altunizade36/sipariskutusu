-- Use the enum values added in 017 after that migration commits.

update public.listings
set status = 'pending'
where status::text = 'paused';

alter table public.listings
  alter column status set default 'pending';
