-- ============================================================
-- Supabase Security/RLS Audit Queries
-- Run in Supabase SQL Editor (production/staging) after migrations.
-- ============================================================

-- 1) RLS status for all public tables
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

-- 2) Tables missing RLS
select
  n.nspname as schema_name,
  c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false
order by c.relname;

-- 3) Policy inventory for critical tables
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
  and tablename in (
    'profiles',
    'listings',
    'messages',
    'conversations',
    'conversation_participants',
    'reports',
    'listing_moderation_audits',
    'objects'
  )
order by schemaname, tablename, policyname;

-- 4) Dangerous broad policies (manual review expected if any rows return)
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
  and (
    coalesce(lower(qual), '') like '%true%'
    or coalesce(lower(with_check), '') like '%true%'
    or coalesce(lower(qual), '') like '%auth.uid() is not null%'
    or coalesce(lower(with_check), '') like '%auth.uid() is not null%'
  )
order by schemaname, tablename, policyname;

-- 5) Function execute grants for sensitive functions
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.oid::regprocedure::text as signature,
  pg_get_userbyid(p.proowner) as function_owner,
  p.prosecdef as security_definer,
  p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'is_admin',
    'is_admin_profile',
    'ban_user_admin',
    'unban_user_admin',
    'get_pending_listings_admin',
    'get_open_reports_admin',
    'review_listing_admin',
    'review_report_admin',
    'can_access_message_media_object'
  )
order by p.proname;

-- 6) Storage bucket policy matrix
select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;

-- 7) Quick assertions (expected = 0 rows)
-- 7.a Anon must not have execute on sensitive admin functions
select p.oid::regprocedure::text as function_signature
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'ban_user_admin',
    'unban_user_admin',
    'get_pending_listings_admin',
    'get_open_reports_admin'
  )
  and exists (
    select 1
    from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
    join pg_roles r on r.oid = x.grantee
    where r.rolname = 'anon'
      and x.privilege_type = 'EXECUTE'
  );

-- 7.b Profiles should not have permissive update policy without owner check
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'profiles'
  and cmd = 'UPDATE'
  and (
    coalesce(lower(qual), '') not like '%auth.uid()%id%'
    or coalesce(lower(with_check), '') not like '%auth.uid()%id%'
  );
