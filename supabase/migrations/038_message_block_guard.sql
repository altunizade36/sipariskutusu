-- Enforce message blocking at DB level regardless of overlapping legacy RLS policies.

create or replace function public.enforce_message_block_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_counterpart_id uuid;
begin
  select c.buyer_id, c.seller_id
  into v_buyer_id, v_seller_id
  from public.conversations c
  where c.id = new.conversation_id;

  if v_buyer_id is null then
    raise exception 'Conversation not found.';
  end if;

  if new.sender_id = v_buyer_id then
    v_counterpart_id := v_seller_id;
  elsif new.sender_id = v_seller_id then
    v_counterpart_id := v_buyer_id;
  else
    raise exception 'Sender is not a participant of this conversation.';
  end if;

  if exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = new.sender_id and b.blocked_id = v_counterpart_id)
       or (b.blocker_id = v_counterpart_id and b.blocked_id = new.sender_id)
  ) then
    raise exception 'Mesajlasma engellendi. Taraflardan biri digerini engellemis.';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_block_guard_before_insert on public.messages;
create trigger messages_block_guard_before_insert
before insert on public.messages
for each row execute function public.enforce_message_block_guard();
