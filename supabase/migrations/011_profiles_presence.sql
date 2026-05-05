-- Presence / last-seen desteği
-- Kullanıcı çevrimiçi durumu ve son görülme bilgisini güvenli şekilde tutar.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.set_my_presence(p_is_online BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET
    is_online = p_is_online,
    last_seen_at = NOW(),
    updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_presence(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_presence(BOOLEAN) TO authenticated;
