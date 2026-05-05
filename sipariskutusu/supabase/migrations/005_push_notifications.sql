-- ============================================================
-- SİPARİŞKUTUSU — PUSH TOKEN TABLOSU
-- Expo push token kaydi icin gerekli tablo + RLS politikalari
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS user_push_tokens_user_idx ON public.user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS user_push_tokens_token_idx ON public.user_push_tokens(token);

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_push_tokens" ON public.user_push_tokens;
CREATE POLICY "users_read_own_push_tokens"
  ON public.user_push_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_push_tokens" ON public.user_push_tokens;
CREATE POLICY "users_insert_own_push_tokens"
  ON public.user_push_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_push_tokens" ON public.user_push_tokens;
CREATE POLICY "users_update_own_push_tokens"
  ON public.user_push_tokens
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_push_tokens" ON public.user_push_tokens;
CREATE POLICY "users_delete_own_push_tokens"
  ON public.user_push_tokens
  FOR DELETE
  USING (auth.uid() = user_id);
