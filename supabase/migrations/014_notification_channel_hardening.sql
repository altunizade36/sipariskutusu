-- ============================================================
-- SIPARISKUTUSU - NOTIFICATION CHANNEL HARDENING
-- Push token metadata + kanal bazli teslimat kayitlari
-- ============================================================

ALTER TABLE public.user_push_tokens
  ADD COLUMN IF NOT EXISTS provider TEXT;

ALTER TABLE public.user_push_tokens
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

ALTER TABLE public.user_push_tokens
  ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE public.user_push_tokens
  ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0;

UPDATE public.user_push_tokens
SET provider = COALESCE(provider, 'expo')
WHERE provider IS NULL;

ALTER TABLE public.user_push_tokens
  DROP CONSTRAINT IF EXISTS user_push_tokens_provider_check;

ALTER TABLE public.user_push_tokens
  ADD CONSTRAINT user_push_tokens_provider_check
  CHECK (provider IN ('expo', 'fcm', 'apns', 'webpush'));

CREATE INDEX IF NOT EXISTS user_push_tokens_provider_active_idx
  ON public.user_push_tokens(provider, is_active);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('push', 'sms', 'email')),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed')),
  provider TEXT,
  provider_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_deliveries_request_idx
  ON public.notification_deliveries(request_id);

CREATE INDEX IF NOT EXISTS notification_deliveries_user_idx
  ON public.notification_deliveries(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_deliveries_channel_status_idx
  ON public.notification_deliveries(channel, status, created_at DESC);
