-- ============================================================
-- 009_messaging_backend_alignment.sql
-- Messaging-first backend alignment and compatibility migration
-- Safe to run on projects created from previous migrations.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Enums for messaging flow
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'conversation_type') then
    create type public.conversation_type as enum ('listing_conversation', 'store_conversation');
  end if;

  if not exists (select 1 from pg_type where typname = 'message_type') then
    create type public.message_type as enum ('text', 'image', 'offer', 'system');
  end if;

  if not exists (select 1 from pg_type where typname = 'offer_status') then
    create type public.offer_status as enum ('pending', 'accepted', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'message_delivery_status') then
    create type public.message_delivery_status as enum ('sending', 'sent', 'delivered', 'seen');
  end if;
end $$;

-- ------------------------------------------------------------
-- Stores: make service schema compatible
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.stores') is null then
    raise exception 'public.stores table is missing. Run 001_schema.sql first.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stores' and column_name = 'seller_id'
  ) then
    alter table public.stores add column seller_id uuid;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stores' and column_name = 'owner_id'
  ) then
    execute 'update public.stores set seller_id = coalesce(seller_id, owner_id)';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stores' and column_name = 'default_stock'
  ) then
    alter table public.stores add column default_stock integer not null default 1;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stores' and column_name = 'delivery_info'
  ) then
    alter table public.stores add column delivery_info text not null default 'Satici ile gorusulur';
  end if;

  if exists (select 1 from public.stores where seller_id is null) then
    raise exception 'stores.seller_id contains NULL values. Backfill required before continuing.';
  end if;

  alter table public.stores alter column seller_id set not null;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'stores_seller_id_fkey'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_seller_id_fkey
      foreign key (seller_id) references public.profiles(id) on delete cascade;
  end if;

  create unique index if not exists stores_seller_id_unique on public.stores(seller_id);
end $$;

alter table public.stores enable row level security;

drop policy if exists "Sahip mağaza yönetir" on public.stores;
drop policy if exists "stores_manage_own_v2" on public.stores;
create policy "stores_manage_own_v2"
  on public.stores
  for all
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

-- ------------------------------------------------------------
-- Store terms acceptance: replace invalid cross-table CHECK with trigger
-- ------------------------------------------------------------
create table if not exists public.store_terms_acceptance (
  id uuid primary key default gen_random_uuid(),
  store_id uuid unique not null references public.stores(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  accepted_terms_of_service boolean not null default false,
  accepted_privacy_policy boolean not null default false,
  accepted_kvkk boolean not null default false,
  accepted_platform_liability boolean not null default false,
  all_accepted boolean generated always as (
    accepted_terms_of_service and accepted_privacy_policy and accepted_kvkk and accepted_platform_liability
  ) stored,
  accepted_ip_address text,
  accepted_user_agent text,
  accepted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cleanup constraints left from previous attempts
alter table public.store_terms_acceptance drop constraint if exists seller_store_match;
alter table public.store_terms_acceptance drop constraint if exists store_terms_acceptance_seller_id_fkey;

alter table public.store_terms_acceptance
  add constraint store_terms_acceptance_seller_id_fkey
  foreign key (seller_id) references public.profiles(id) on delete cascade;

create index if not exists store_terms_acceptance_store_idx on public.store_terms_acceptance(store_id);
create index if not exists store_terms_acceptance_seller_idx on public.store_terms_acceptance(seller_id);

create or replace function public.validate_store_terms_owner()
returns trigger
language plpgsql
as $$
declare
  v_store_seller uuid;
begin
  select seller_id into v_store_seller
  from public.stores
  where id = new.store_id;

  if v_store_seller is null then
    raise exception 'Store not found for terms acceptance';
  end if;

  if new.seller_id <> v_store_seller then
    raise exception 'seller_id must match stores.seller_id';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists store_terms_acceptance_validate_trigger on public.store_terms_acceptance;
create trigger store_terms_acceptance_validate_trigger
before insert or update on public.store_terms_acceptance
for each row execute function public.validate_store_terms_owner();

alter table public.store_terms_acceptance enable row level security;
drop policy if exists "Sellers can view their own terms acceptance" on public.store_terms_acceptance;
drop policy if exists "Sellers can insert their own terms acceptance" on public.store_terms_acceptance;
drop policy if exists "Sellers can update their own terms acceptance" on public.store_terms_acceptance;

create policy "store_terms_select_own"
  on public.store_terms_acceptance
  for select
  using (auth.uid() = seller_id);

create policy "store_terms_insert_own"
  on public.store_terms_acceptance
  for insert
  with check (auth.uid() = seller_id);

create policy "store_terms_update_own"
  on public.store_terms_acceptance
  for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

-- ------------------------------------------------------------
-- Conversations schema extension
-- ------------------------------------------------------------
alter table public.conversations
  add column if not exists type public.conversation_type not null default 'listing_conversation',
  add column if not exists store_id uuid references public.stores(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists buyer_unread_count integer not null default 0,
  add column if not exists seller_unread_count integer not null default 0;

update public.conversations
set buyer_unread_count = coalesce(buyer_unread_count, buyer_unread, 0),
    seller_unread_count = coalesce(seller_unread_count, seller_unread, 0);

-- Infer conversation type for existing rows
update public.conversations
set type = case when listing_id is null then 'store_conversation'::public.conversation_type else 'listing_conversation'::public.conversation_type end
where type is null;

create index if not exists conversations_participants_idx on public.conversations(buyer_id, seller_id);
create index if not exists conversations_last_message_at_idx on public.conversations(last_message_at desc);
create index if not exists conversations_listing_idx on public.conversations(listing_id);
create index if not exists conversations_store_idx on public.conversations(store_id);

-- Uniqueness rules from product requirements
create unique index if not exists conversations_unique_listing_pair
  on public.conversations (buyer_id, seller_id, listing_id)
  where type = 'listing_conversation' and listing_id is not null;

create unique index if not exists conversations_unique_store_pair
  on public.conversations (buyer_id, seller_id, store_id)
  where type = 'store_conversation' and store_id is not null;

-- ------------------------------------------------------------
-- Messages schema extension
-- ------------------------------------------------------------
alter table public.messages
  add column if not exists receiver_id uuid references public.profiles(id) on delete set null,
  add column if not exists message_type public.message_type not null default 'text',
  add column if not exists image_url text,
  add column if not exists offer_amount numeric(10,2),
  add column if not exists offer_status public.offer_status,
  add column if not exists status public.message_delivery_status not null default 'sent',
  add column if not exists seen_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index if not exists messages_receiver_idx on public.messages(receiver_id);
create index if not exists messages_status_idx on public.messages(status);

-- Backfill receiver_id and statuses
update public.messages m
set receiver_id = case
  when c.buyer_id = m.sender_id then c.seller_id
  else c.buyer_id
end
from public.conversations c
where c.id = m.conversation_id
  and m.receiver_id is null;

update public.messages
set status = case when coalesce(is_read, false) then 'seen'::public.message_delivery_status else 'sent'::public.message_delivery_status end
where status is null;

update public.messages
set seen_at = coalesce(seen_at, created_at)
where seen_at is null and (coalesce(is_read, false) = true or status = 'seen');

-- ------------------------------------------------------------
-- Blocking model for moderation
-- ------------------------------------------------------------
create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique(blocker_id, blocked_id),
  constraint user_blocks_no_self check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocker_idx on public.user_blocks(blocker_id);
create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;
drop policy if exists "user_blocks_manage_own" on public.user_blocks;
create policy "user_blocks_manage_own"
  on public.user_blocks
  for all
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

-- ------------------------------------------------------------
-- Policy hardening for conversations/messages
-- ------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Konuşma tarafları okuyabilir" on public.conversations;
drop policy if exists "Alıcı konuşma başlatır" on public.conversations;
drop policy if exists "Taraflar konuşmayı güncelleyebilir" on public.conversations;

drop policy if exists "conv_read_participants_v2" on public.conversations;
drop policy if exists "conv_insert_buyer_v2" on public.conversations;
drop policy if exists "conv_update_participants_v2" on public.conversations;

create policy "conv_read_participants_v2"
  on public.conversations
  for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "conv_insert_buyer_v2"
  on public.conversations
  for insert
  with check (
    auth.uid() = buyer_id
    and buyer_id <> seller_id
    and not exists (
      select 1
      from public.user_blocks b
      where b.blocker_id = seller_id
        and b.blocked_id = buyer_id
    )
  );

create policy "conv_update_participants_v2"
  on public.conversations
  for update
  using (auth.uid() = buyer_id or auth.uid() = seller_id)
  with check (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Konuşma tarafları mesaj okur" on public.messages;
drop policy if exists "Konuşma tarafları mesaj gönderir" on public.messages;

drop policy if exists "msg_read_participants_v2" on public.messages;
drop policy if exists "msg_insert_participants_v2" on public.messages;
drop policy if exists "msg_update_participants_v2" on public.messages;

create policy "msg_read_participants_v2"
  on public.messages
  for select
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

create policy "msg_insert_participants_v2"
  on public.messages
  for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
    and not exists (
      select 1
      from public.user_blocks b
      join public.conversations c on c.id = messages.conversation_id
      where b.blocker_id = case when c.buyer_id = auth.uid() then c.seller_id else c.buyer_id end
        and b.blocked_id = auth.uid()
    )
  );

create policy "msg_update_participants_v2"
  on public.messages
  for update
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- ------------------------------------------------------------
-- Messaging utility functions
-- ------------------------------------------------------------
create or replace function public.increment_unread(conv_id uuid, field text)
returns void
language plpgsql
security definer
as $$
begin
  if field = 'buyer_unread' then
    update public.conversations
    set buyer_unread = coalesce(buyer_unread, 0) + 1,
        buyer_unread_count = coalesce(buyer_unread_count, 0) + 1,
        updated_at = now()
    where id = conv_id;
  elsif field = 'seller_unread' then
    update public.conversations
    set seller_unread = coalesce(seller_unread, 0) + 1,
        seller_unread_count = coalesce(seller_unread_count, 0) + 1,
        updated_at = now()
    where id = conv_id;
  else
    raise exception 'Unsupported unread field: %', field;
  end if;
end;
$$;

create or replace function public.sync_message_defaults()
returns trigger
language plpgsql
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
begin
  select buyer_id, seller_id
  into v_buyer_id, v_seller_id
  from public.conversations
  where id = new.conversation_id;

  if v_buyer_id is null then
    raise exception 'Conversation not found: %', new.conversation_id;
  end if;

  if new.receiver_id is null then
    if new.sender_id = v_buyer_id then
      new.receiver_id = v_seller_id;
    else
      new.receiver_id = v_buyer_id;
    end if;
  end if;

  if new.message_type is null then
    if new.offer_amount is not null then
      new.message_type = 'offer'::public.message_type;
    elsif new.image_url is not null or new.attachment_url is not null then
      new.message_type = 'image'::public.message_type;
    else
      new.message_type = 'text'::public.message_type;
    end if;
  end if;

  if new.message_type = 'offer' and new.offer_amount is null then
    raise exception 'offer message requires offer_amount';
  end if;

  if new.status is null then
    new.status = 'sent'::public.message_delivery_status;
  end if;

  if new.status = 'seen' and new.seen_at is null then
    new.seen_at = now();
    new.is_read = true;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists messages_defaults_trigger on public.messages;
create trigger messages_defaults_trigger
before insert or update on public.messages
for each row execute function public.sync_message_defaults();

create or replace function public.on_message_insert_sync_conversation()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
  set
    last_message = case
      when new.message_type = 'offer' then concat('Teklif: ', coalesce(new.offer_amount::text, ''), ' TL')
      when new.message_type = 'image' then coalesce(new.body, 'Gorsel paylasildi')
      when new.message_type = 'system' then coalesce(new.body, 'Sistem mesaji')
      else coalesce(new.body, '')
    end,
    last_message_at = new.created_at,
    updated_at = now(),
    buyer_unread = case when new.sender_id = buyer_id then coalesce(buyer_unread, 0) else coalesce(buyer_unread, 0) + 1 end,
    seller_unread = case when new.sender_id = seller_id then coalesce(seller_unread, 0) else coalesce(seller_unread, 0) + 1 end,
    buyer_unread_count = case when new.sender_id = buyer_id then coalesce(buyer_unread_count, 0) else coalesce(buyer_unread_count, 0) + 1 end,
    seller_unread_count = case when new.sender_id = seller_id then coalesce(seller_unread_count, 0) else coalesce(seller_unread_count, 0) + 1 end
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists messages_after_insert_sync_conversation on public.messages;
create trigger messages_after_insert_sync_conversation
after insert on public.messages
for each row execute function public.on_message_insert_sync_conversation();

create or replace function public.mark_conversation_seen(p_conversation_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_uid uuid;
  v_conv public.conversations%rowtype;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_conv
  from public.conversations
  where id = p_conversation_id;

  if v_conv.id is null then
    raise exception 'Conversation not found';
  end if;

  if v_uid <> v_conv.buyer_id and v_uid <> v_conv.seller_id then
    raise exception 'Not allowed';
  end if;

  update public.messages
  set
    is_read = true,
    status = 'seen'::public.message_delivery_status,
    seen_at = coalesce(seen_at, now()),
    updated_at = now()
  where conversation_id = p_conversation_id
    and sender_id <> v_uid
    and (coalesce(is_read, false) = false or status <> 'seen');

  if v_uid = v_conv.buyer_id then
    update public.conversations
    set buyer_unread = 0,
        buyer_unread_count = 0,
        updated_at = now()
    where id = p_conversation_id;
  else
    update public.conversations
    set seller_unread = 0,
        seller_unread_count = 0,
        updated_at = now()
    where id = p_conversation_id;
  end if;
end;
$$;

create or replace function public.get_or_create_conversation(
  p_seller_id uuid,
  p_listing_id uuid default null,
  p_store_id uuid default null,
  p_type public.conversation_type default 'listing_conversation'
)
returns public.conversations
language plpgsql
security definer
as $$
declare
  v_uid uuid;
  v_store_id uuid;
  v_conv public.conversations%rowtype;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_seller_id is null then
    raise exception 'seller is required';
  end if;

  if v_uid = p_seller_id then
    raise exception 'Cannot create conversation with yourself';
  end if;

  if p_type = 'listing_conversation' and p_listing_id is null then
    raise exception 'listing_conversation requires listing_id';
  end if;

  if p_type = 'store_conversation' and p_store_id is null then
    raise exception 'store_conversation requires store_id';
  end if;

  if p_listing_id is not null then
    select store_id into v_store_id from public.listings where id = p_listing_id;
  else
    v_store_id := p_store_id;
  end if;

  select * into v_conv
  from public.conversations c
  where c.type = p_type
    and c.buyer_id = v_uid
    and c.seller_id = p_seller_id
    and (
      (p_type = 'listing_conversation' and c.listing_id = p_listing_id)
      or
      (p_type = 'store_conversation' and c.store_id = v_store_id)
    )
  limit 1;

  if v_conv.id is not null then
    return v_conv;
  end if;

  begin
    insert into public.conversations (
      type,
      listing_id,
      store_id,
      buyer_id,
      seller_id,
      buyer_unread,
      seller_unread,
      buyer_unread_count,
      seller_unread_count,
      created_at,
      updated_at
    )
    values (
      p_type,
      p_listing_id,
      case when p_type = 'store_conversation' then v_store_id else null end,
      v_uid,
      p_seller_id,
      0,
      0,
      0,
      0,
      now(),
      now()
    )
    returning * into v_conv;
  exception
    when unique_violation then
      select * into v_conv
      from public.conversations c
      where c.type = p_type
        and c.buyer_id = v_uid
        and c.seller_id = p_seller_id
        and (
          (p_type = 'listing_conversation' and c.listing_id = p_listing_id)
          or
          (p_type = 'store_conversation' and c.store_id = v_store_id)
        )
      limit 1;
  end;

  return v_conv;
end;
$$;

-- Notification on new message
create or replace function public.notify_new_message()
returns trigger
language plpgsql
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

drop trigger if exists messages_notify_new_message on public.messages;
create trigger messages_notify_new_message
after insert on public.messages
for each row execute function public.notify_new_message();

-- Realtime publication safety
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;
