-- Modern chat foundation: participants, attachments, typing, unread sync, storage hardening.

-- 1) Conversations compatibility fields
alter table public.conversations
  add column if not exists chat_type text not null default 'direct',
  add column if not exists last_message_text text;

alter table public.conversations
  drop constraint if exists conversations_chat_type_check;

alter table public.conversations
  add constraint conversations_chat_type_check
  check (chat_type in ('direct', 'group'));

update public.conversations
set last_message_text = coalesce(last_message_text, last_message)
where last_message_text is null;

-- 2) Participants table
create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  last_read_at timestamptz,
  unread_count integer not null default 0,
  muted boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(conversation_id, user_id)
);

create index if not exists conversation_participants_user_id_idx
  on public.conversation_participants(user_id);
create index if not exists conversation_participants_conversation_id_idx
  on public.conversation_participants(conversation_id);

-- Backfill buyer/seller into participants for legacy conversations.
insert into public.conversation_participants (conversation_id, user_id, role, last_read_at, unread_count, muted, archived)
select c.id, c.buyer_id, 'member', null, coalesce(c.buyer_unread_count, c.buyer_unread, 0), false, false
from public.conversations c
on conflict (conversation_id, user_id) do update
set unread_count = excluded.unread_count,
    updated_at = now();

insert into public.conversation_participants (conversation_id, user_id, role, last_read_at, unread_count, muted, archived)
select c.id, c.seller_id, 'member', null, coalesce(c.seller_unread_count, c.seller_unread, 0), false, false
from public.conversations c
on conflict (conversation_id, user_id) do update
set unread_count = excluded.unread_count,
    updated_at = now();

-- 3) Messages enhancements
alter table public.messages
  add column if not exists text text,
  add column if not exists listing_id uuid references public.listings(id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists messages_conversation_id_idx
  on public.messages(conversation_id);
create index if not exists messages_created_at_idx
  on public.messages(created_at);

update public.messages
set text = coalesce(text, body)
where text is null;

-- 4) Message attachments
create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  file_url text not null,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index if not exists message_attachments_message_id_idx
  on public.message_attachments(message_id);

-- 5) Typing indicator table
create table if not exists public.conversation_typing (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_typing boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(conversation_id, user_id)
);

create index if not exists conversation_typing_conversation_idx
  on public.conversation_typing(conversation_id);

-- 6) Sync participants on new conversation
create or replace function public.ensure_conversation_participants_from_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.conversation_participants (conversation_id, user_id, role)
  values (new.id, new.buyer_id, 'member')
  on conflict (conversation_id, user_id) do nothing;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values (new.id, new.seller_id, 'member')
  on conflict (conversation_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists conversations_ensure_participants on public.conversations;
create trigger conversations_ensure_participants
after insert on public.conversations
for each row execute function public.ensure_conversation_participants_from_row();

-- 7) Messages defaults + unread + preview sync
create or replace function public.messages_defaults_v3()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.body := coalesce(new.body, new.text, '');
  new.text := coalesce(new.text, new.body, '');

  if new.image_url is null and new.attachment_url is not null then
    new.image_url := new.attachment_url;
  end if;

  if new.status is null then
    new.status := 'sent'::public.message_delivery_status;
  end if;

  if new.message_type is null then
    new.message_type := case when new.image_url is not null then 'image'::public.message_type else 'text'::public.message_type end;
  end if;

  return new;
end;
$$;

drop trigger if exists messages_defaults_trigger on public.messages;
create trigger messages_defaults_trigger
before insert or update on public.messages
for each row execute function public.messages_defaults_v3();

create or replace function public.sync_conversation_preview_and_unread_v3()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    last_message_text = case
      when coalesce(new.deleted_at, null) is not null then '[Mesaj silindi]'
      when coalesce(new.text, '') <> '' then left(new.text, 300)
      when new.image_url is not null then '[Gorsel]'
      else '[Mesaj]'
    end,
    last_message = case
      when coalesce(new.deleted_at, null) is not null then '[Mesaj silindi]'
      when coalesce(new.text, '') <> '' then left(new.text, 300)
      when new.image_url is not null then '[Gorsel]'
      else '[Mesaj]'
    end,
    last_message_at = new.created_at,
    updated_at = now()
  where id = new.conversation_id;

  update public.conversation_participants cp
  set
    unread_count = case when cp.user_id = new.sender_id then cp.unread_count else cp.unread_count + 1 end,
    updated_at = now()
  where cp.conversation_id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists messages_after_insert_sync_conversation on public.messages;
create trigger messages_after_insert_sync_conversation
after insert on public.messages
for each row execute function public.sync_conversation_preview_and_unread_v3();

-- Keep legacy unread counters synced from participant table.
create or replace function public.sync_legacy_unread_from_participants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations c
  set
    buyer_unread = coalesce((
      select cp.unread_count
      from public.conversation_participants cp
      where cp.conversation_id = c.id and cp.user_id = c.buyer_id
      limit 1
    ), 0),
    seller_unread = coalesce((
      select cp.unread_count
      from public.conversation_participants cp
      where cp.conversation_id = c.id and cp.user_id = c.seller_id
      limit 1
    ), 0),
    buyer_unread_count = coalesce((
      select cp.unread_count
      from public.conversation_participants cp
      where cp.conversation_id = c.id and cp.user_id = c.buyer_id
      limit 1
    ), 0),
    seller_unread_count = coalesce((
      select cp.unread_count
      from public.conversation_participants cp
      where cp.conversation_id = c.id and cp.user_id = c.seller_id
      limit 1
    ), 0)
  where c.id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists conversation_participants_sync_legacy_unread on public.conversation_participants;
create trigger conversation_participants_sync_legacy_unread
after insert or update of unread_count on public.conversation_participants
for each row execute function public.sync_legacy_unread_from_participants();

-- 8) Read API for modern clients
create or replace function public.mark_conversation_seen_v2(
  p_conversation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = v_uid
  ) then
    raise exception 'Bu konusmaya erisiminiz yok.';
  end if;

  update public.messages m
  set
    is_read = true,
    status = 'seen'::public.message_delivery_status,
    seen_at = coalesce(m.seen_at, now())
  where m.conversation_id = p_conversation_id
    and m.sender_id <> v_uid
    and (coalesce(m.is_read, false) = false or m.status <> 'seen'::public.message_delivery_status);

  update public.conversation_participants cp
  set
    last_read_at = now(),
    unread_count = 0,
    updated_at = now()
  where cp.conversation_id = p_conversation_id
    and cp.user_id = v_uid;
end;
$$;

grant execute on function public.mark_conversation_seen_v2(uuid) to authenticated;

-- 9) Typing API
create or replace function public.set_conversation_typing(
  p_conversation_id uuid,
  p_is_typing boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = v_uid
  ) then
    raise exception 'Bu konusmaya erisiminiz yok.';
  end if;

  insert into public.conversation_typing (conversation_id, user_id, is_typing, updated_at)
  values (p_conversation_id, v_uid, p_is_typing, now())
  on conflict (conversation_id, user_id)
  do update set is_typing = excluded.is_typing, updated_at = now();
end;
$$;

grant execute on function public.set_conversation_typing(uuid, boolean) to authenticated;

-- 10) RLS
alter table public.conversation_participants enable row level security;
alter table public.message_attachments enable row level security;
alter table public.conversation_typing enable row level security;

drop policy if exists "cp_select_own" on public.conversation_participants;
create policy "cp_select_own"
  on public.conversation_participants
  for select
  using (auth.uid() = user_id);

drop policy if exists "cp_update_own" on public.conversation_participants;
create policy "cp_update_own"
  on public.conversation_participants
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "cp_insert_self" on public.conversation_participants;
create policy "cp_insert_self"
  on public.conversation_participants
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "attachments_select_participants" on public.message_attachments;
create policy "attachments_select_participants"
  on public.message_attachments
  for select
  using (
    exists (
      select 1
      from public.messages m
      join public.conversation_participants cp on cp.conversation_id = m.conversation_id
      where m.id = message_attachments.message_id
        and cp.user_id = auth.uid()
    )
  );

drop policy if exists "attachments_insert_sender" on public.message_attachments;
create policy "attachments_insert_sender"
  on public.message_attachments
  for insert
  with check (
    exists (
      select 1
      from public.messages m
      join public.conversation_participants cp on cp.conversation_id = m.conversation_id
      where m.id = message_attachments.message_id
        and m.sender_id = auth.uid()
        and cp.user_id = auth.uid()
    )
  );

drop policy if exists "typing_select_participants" on public.conversation_typing;
create policy "typing_select_participants"
  on public.conversation_typing
  for select
  using (
    exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = conversation_typing.conversation_id
        and cp.user_id = auth.uid()
    )
  );

drop policy if exists "typing_upsert_self" on public.conversation_typing;
create policy "typing_upsert_self"
  on public.conversation_typing
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 11) Storage: chat-attachments bucket + policies
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

create or replace function public.can_access_chat_attachment(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_segment text;
begin
  v_segment := split_part(coalesce(p_name, ''), '/', 1);

  if v_segment = '' or v_segment !~* '^[0-9a-f-]{36}$' then
    return false;
  end if;

  v_conversation_id := v_segment::uuid;

  return exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = v_conversation_id
      and cp.user_id = auth.uid()
  );
end;
$$;

drop policy if exists "chat_attachments_select" on storage.objects;
create policy "chat_attachments_select"
  on storage.objects
  for select
  using (
    bucket_id = 'chat-attachments'
    and auth.uid() is not null
    and public.can_access_chat_attachment(name)
  );

drop policy if exists "chat_attachments_insert" on storage.objects;
create policy "chat_attachments_insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'chat-attachments'
    and auth.uid() is not null
    and owner = auth.uid()
    and public.can_access_chat_attachment(name)
  );

drop policy if exists "chat_attachments_update_own" on storage.objects;
create policy "chat_attachments_update_own"
  on storage.objects
  for update
  using (
    bucket_id = 'chat-attachments'
    and auth.uid() is not null
    and owner = auth.uid()
  )
  with check (
    bucket_id = 'chat-attachments'
    and auth.uid() is not null
    and owner = auth.uid()
  );

drop policy if exists "chat_attachments_delete_own" on storage.objects;
create policy "chat_attachments_delete_own"
  on storage.objects
  for delete
  using (
    bucket_id = 'chat-attachments'
    and auth.uid() is not null
    and owner = auth.uid()
  );

-- 12) Realtime publication

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversation_participants'
  ) then
    alter publication supabase_realtime add table public.conversation_participants;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversation_typing'
  ) then
    alter publication supabase_realtime add table public.conversation_typing;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_attachments'
  ) then
    alter publication supabase_realtime add table public.message_attachments;
  end if;
end $$;
