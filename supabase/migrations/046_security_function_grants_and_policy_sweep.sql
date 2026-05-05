-- ============================================================
-- 046_security_function_grants_and_policy_sweep.sql
-- Additional hardening after 045:
-- - Revoke broad execute grants from anon/public
-- - Keep authenticated-only access for security helper functions
-- - Remove any legacy broad message policies if present
-- ============================================================

-- 1) Admin helper function grant hardening
-- (Defined in 020; keep callable only by authenticated users.)
revoke all on function public.is_admin(uuid) from public;
revoke all on function public.is_admin(uuid) from anon;
grant execute on function public.is_admin(uuid) to authenticated;

-- 2) Message-media helper function grant hardening
-- (Defined in 045; required by storage policies for authenticated users.)
revoke all on function public.can_access_message_media_object(text) from public;
revoke all on function public.can_access_message_media_object(text) from anon;
grant execute on function public.can_access_message_media_object(text) to authenticated;

-- 3) Presence helper should never be callable by anon/public
revoke all on function public.set_my_presence(boolean) from public;
revoke all on function public.set_my_presence(boolean) from anon;
grant execute on function public.set_my_presence(boolean) to authenticated;

-- 4) Admin RPC grants (defense-in-depth)
revoke all on function public.get_pending_listings_admin(integer, integer) from public;
revoke all on function public.get_pending_listings_admin(integer, integer) from anon;
revoke all on function public.get_open_reports_admin(integer, integer) from public;
revoke all on function public.get_open_reports_admin(integer, integer) from anon;
revoke all on function public.ban_user_admin(uuid, text) from public;
revoke all on function public.ban_user_admin(uuid, text) from anon;
revoke all on function public.unban_user_admin(uuid) from public;
revoke all on function public.unban_user_admin(uuid) from anon;

grant execute on function public.get_pending_listings_admin(integer, integer) to authenticated;
grant execute on function public.get_open_reports_admin(integer, integer) to authenticated;
grant execute on function public.ban_user_admin(uuid, text) to authenticated;
grant execute on function public.unban_user_admin(uuid) to authenticated;

-- 5) Sweep legacy broad message policies if they still exist
alter table public.messages enable row level security;

drop policy if exists "Taraflar mesajı güncelleyebilir" on public.messages;
drop policy if exists "Mesajlar taraflarca güncellenebilir" on public.messages;
drop policy if exists "messages_update_participants" on public.messages;

-- Keep strict sender-only ownership policies in place.
drop policy if exists "messages_update_sender_only" on public.messages;
create policy "messages_update_sender_only"
  on public.messages
  for update
  using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id);

drop policy if exists "messages_delete_sender_only" on public.messages;
create policy "messages_delete_sender_only"
  on public.messages
  for delete
  using (auth.uid() = sender_id);

-- 6) Explicitly ensure anon cannot mutate sensitive core tables
revoke insert, update, delete on table public.profiles from anon;
revoke insert, update, delete on table public.listings from anon;
revoke insert, update, delete on table public.messages from anon;
revoke insert, update, delete on table public.conversations from anon;
