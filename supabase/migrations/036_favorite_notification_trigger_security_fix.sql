-- Favorites notification trigger must bypass notifications RLS safely.

create or replace function public.notify_listing_favorited()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_already_notified boolean := false;
begin
  select l.seller_id
  into v_seller_id
  from public.listings l
  where l.id = new.listing_id;

  if v_seller_id is null or v_seller_id = new.user_id then
    return new;
  end if;

  select exists (
    select 1
    from public.notifications n
    where n.user_id = v_seller_id
      and n.type = 'listing_favorited'
      and n.created_at >= now() - interval '24 hours'
      and coalesce(n.data ->> 'listing_id', '') = new.listing_id::text
      and coalesce(n.data ->> 'actor_user_id', '') = new.user_id::text
  )
  into v_already_notified;

  if not v_already_notified then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      v_seller_id,
      'listing_favorited',
      'İlanın favorilere eklendi',
      'Bir kullanıcı ilanını favorilerine ekledi.',
      jsonb_build_object(
        'listing_id', new.listing_id,
        'actor_user_id', new.user_id,
        'event', 'favorite_added'
      )
    );
  end if;

  return new;
end;
$$;
