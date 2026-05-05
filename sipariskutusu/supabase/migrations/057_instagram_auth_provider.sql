ALTER TABLE public.instagram_accounts
  ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'facebook'
    CHECK (auth_provider IN ('facebook', 'instagram'));

COMMENT ON COLUMN public.instagram_accounts.auth_provider IS 'OAuth provider used for the account: Facebook Login for Business or Instagram Login.';
