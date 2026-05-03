-- ============================================================
-- 054_notification_deliveries_rls.sql
-- Enable RLS on notification_deliveries to prevent unauthorized
-- access to push tokens, email addresses, and phone numbers
-- stored in the recipient column.
-- ============================================================

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

-- Admins can read all delivery records for auditing.
DROP POLICY IF EXISTS "notification_deliveries_select_admin" ON public.notification_deliveries;
CREATE POLICY "notification_deliveries_select_admin"
  ON public.notification_deliveries
  FOR SELECT
  USING (public.is_admin_profile(auth.uid()));

-- Users can read delivery records for their own user_id only.
DROP POLICY IF EXISTS "notification_deliveries_select_own" ON public.notification_deliveries;
CREATE POLICY "notification_deliveries_select_own"
  ON public.notification_deliveries
  FOR SELECT
  USING (
    user_id IS NOT NULL
    AND user_id = auth.uid()
  );

-- Only the service role (edge functions) may insert delivery logs.
-- Authenticated and anon roles are not granted INSERT.
REVOKE INSERT, UPDATE, DELETE ON public.notification_deliveries FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.notification_deliveries FROM anon;
