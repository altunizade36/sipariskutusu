-- ============================================================
-- Instagram Handle (Sosyal Bağlantı) — Manuel, OAuth Yok
-- ============================================================

-- Eski OAuth kolonlarını kaldır
ALTER TABLE public.instagram_accounts DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE public.instagram_accounts DROP COLUMN IF EXISTS instagram_user_id CASCADE;
ALTER TABLE public.instagram_accounts DROP COLUMN IF EXISTS access_token CASCADE;
ALTER TABLE public.instagram_accounts DROP COLUMN IF EXISTS token_expires_at CASCADE;
ALTER TABLE public.instagram_accounts DROP COLUMN IF EXISTS followers_count CASCADE;
ALTER TABLE public.instagram_accounts DROP COLUMN IF EXISTS is_active CASCADE;
ALTER TABLE public.instagram_accounts DROP COLUMN IF EXISTS last_synced_at CASCADE;

-- Yeni kolonlar ekle
ALTER TABLE public.instagram_accounts
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- store_id unique constraint'ini ensure et
ALTER TABLE public.instagram_accounts DROP CONSTRAINT IF EXISTS instagram_accounts_store_id_key;
ALTER TABLE public.instagram_accounts ADD CONSTRAINT instagram_accounts_store_id_key UNIQUE (store_id);

-- Comment ekle
COMMENT ON TABLE public.instagram_accounts IS 'Satıcıların sosyal Instagram handle bağlantıları (OAuth değil, manuel username)';
COMMENT ON COLUMN public.instagram_accounts.instagram_handle IS 'Instagram username (@ işareti olmadan)';
COMMENT ON COLUMN public.instagram_accounts.verified IS 'Admin tarafından doğrulanmış mı (isteğe bağlı)';
