-- Explicitly harden grants for listing comments and RPC functions.

revoke all on table public.listing_comments from anon;
revoke all on table public.listing_comments from authenticated;
grant select on table public.listing_comments to authenticated;

revoke all on function public.add_listing_comment(uuid, text, uuid) from public;
revoke all on function public.add_listing_comment(uuid, text, uuid) from anon;
revoke all on function public.delete_my_listing_comment(uuid) from public;
revoke all on function public.delete_my_listing_comment(uuid) from anon;
revoke all on function public.hide_listing_comment_admin(uuid) from public;
revoke all on function public.hide_listing_comment_admin(uuid) from anon;

grant execute on function public.add_listing_comment(uuid, text, uuid) to authenticated;
grant execute on function public.delete_my_listing_comment(uuid) to authenticated;
grant execute on function public.hide_listing_comment_admin(uuid) to authenticated;