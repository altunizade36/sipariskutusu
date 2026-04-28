-- Fixes for full-flow reliability:
-- 1) listings ban guard was referencing non-existent NEW.user_id
-- 2) message notification trigger must bypass RLS safely

create or replace function public.check_user_not_banned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_banned boolean := false;
  v_owner_id uuid;
begin
  v_owner_id := new.seller_id;

  if v_owner_id is null then
    raise exception 'Geçersiz ilan sahibi.' using errcode = 'P0001';
  end if;

  select coalesce(p.is_banned, false)
  into v_banned
  from public.profiles p
  where p.id = v_owner_id;

  if v_banned then
    raise exception 'Hesabınız askıya alınmıştır.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receiver_id uuid;
  v_sender_name text;
begin
  v_receiver_id := new.receiver_id;

  if v_receiver_id is null then
    select case when c.buyer_id = new.sender_id then c.seller_id else c.buyer_id end
      into v_receiver_id
    from public.conversations c
    where c.id = new.conversation_id;
  end if;

  if v_receiver_id is null or to_regclass('public.notifications') is null then
    return new;
  end if;

  select coalesce(p.full_name, 'Yeni mesaj')
  into v_sender_name
  from public.profiles p
  where p.id = new.sender_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_receiver_id,
    'new_message',
    'Yeni mesaj',
    concat(v_sender_name, ': ', left(coalesce(new.body, 'Yeni mesaj'), 80)),
    jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id)
  );

  return new;
end;
$$;
