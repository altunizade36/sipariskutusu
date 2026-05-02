-- 044b: Functions and triggers from migration 044
-- (comment_count column already added, skipping UPDATE that triggers auth check)

create or replace function public.refresh_listing_favorite_counter(p_listing_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.listings l
  set
    favorite_count = coalesce(src.favorite_count, 0),
    like_count = coalesce(src.favorite_count, 0)
  from (
    select count(*)::integer as favorite_count
    from public.favorites f
    where f.listing_id = p_listing_id
  ) src
  where l.id = p_listing_id;
$$;

create or replace function public.refresh_listing_comment_counter(p_listing_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.listings l
  set comment_count = coalesce(src.comment_count, 0)
  from (
    select count(*)::integer as comment_count
    from public.listing_comments c
    where c.listing_id = p_listing_id
      and c.status = 'active'
  ) src
  where l.id = p_listing_id;
$$;

create or replace function public.sync_listing_favorite_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_listing_favorite_counter(new.listing_id);
  elsif tg_op = 'DELETE' then
    perform public.refresh_listing_favorite_counter(old.listing_id);
  end if;
  return null;
end;
$$;

drop trigger if exists favorites_sync_listing_counter on public.favorites;
create trigger favorites_sync_listing_counter
after insert or delete on public.favorites
for each row execute function public.sync_listing_favorite_counter();

create or replace function public.sync_listing_comment_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_listing_comment_counter(new.listing_id);
  elsif tg_op = 'UPDATE' then
    perform public.refresh_listing_comment_counter(new.listing_id);
    if old.listing_id <> new.listing_id then
      perform public.refresh_listing_comment_counter(old.listing_id);
    end if;
  elsif tg_op = 'DELETE' then
    perform public.refresh_listing_comment_counter(old.listing_id);
  end if;
  return null;
end;
$$;

drop trigger if exists listing_comments_sync_listing_counter on public.listing_comments;
create trigger listing_comments_sync_listing_counter
after insert or update or delete on public.listing_comments
for each row execute function public.sync_listing_comment_counter();

do $$
begin
  begin
    alter publication supabase_realtime add table public.listings;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.favorites;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.listing_comments;
  exception when duplicate_object then null;
  end;
end $$;

grant execute on function public.refresh_listing_favorite_counter(uuid) to authenticated;
grant execute on function public.refresh_listing_comment_counter(uuid) to authenticated;
