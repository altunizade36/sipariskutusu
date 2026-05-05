-- Restore OAuth-backed Instagram account fields for the production integration.

ALTER TABLE public.instagram_accounts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS instagram_user_id TEXT,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS followers_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS media_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_pic_url TEXT,
  ADD COLUMN IF NOT EXISTS account_type TEXT CHECK (account_type IN ('BUSINESS', 'CREATOR')),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS instagram_accounts_instagram_user_id_key
  ON public.instagram_accounts(instagram_user_id)
  WHERE instagram_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS instagram_accounts_user_idx
  ON public.instagram_accounts(user_id);

COMMENT ON COLUMN public.instagram_accounts.access_token IS 'Long-lived Meta/Instagram access token. Keep server-side only.';
COMMENT ON COLUMN public.instagram_accounts.instagram_user_id IS 'Instagram Business/Creator account id returned by Meta Graph API.';
