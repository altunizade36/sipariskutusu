-- 048_seller_profiles_search.sql
-- seller_profiles denormalized view table for fast search + RPC functions

-- pg_trgm for LIKE similarity indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── seller_profiles table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seller_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id        UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id         UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  store_name       TEXT,
  instagram_username TEXT,
  bio              TEXT,
  city             TEXT,
  category         TEXT,
  verified_seller  BOOLEAN NOT NULL DEFAULT false,
  rating           NUMERIC(3,2) NOT NULL DEFAULT 0,
  follower_count   INT NOT NULL DEFAULT 0,
  product_count    INT NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seller_profiles_read_all"
  ON public.seller_profiles FOR SELECT USING (true);

CREATE POLICY "seller_profiles_own_write"
  ON public.seller_profiles FOR ALL
  USING (seller_id = auth.uid());

-- GIN trigram indexes for fast ilike search
CREATE INDEX IF NOT EXISTS idx_seller_profiles_store_name_trgm
  ON public.seller_profiles USING GIN (store_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_seller_profiles_instagram_trgm
  ON public.seller_profiles USING GIN (instagram_username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_seller_profiles_city
  ON public.seller_profiles (city);

CREATE INDEX IF NOT EXISTS idx_seller_profiles_category
  ON public.seller_profiles (category);

-- ── sync function ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_seller_profile_from_store()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.seller_profiles (
    seller_id, store_id, store_name, bio, city, verified_seller,
    rating, follower_count, updated_at
  )
  VALUES (
    NEW.seller_id, NEW.id, NEW.name, NEW.description, NEW.city,
    COALESCE(NEW.is_verified, false),
    COALESCE(NEW.rating, 0), COALESCE(NEW.follower_count, 0), NOW()
  )
  ON CONFLICT (seller_id) DO UPDATE SET
    store_id        = EXCLUDED.store_id,
    store_name      = EXCLUDED.store_name,
    bio             = EXCLUDED.bio,
    city            = EXCLUDED.city,
    verified_seller = EXCLUDED.verified_seller,
    rating          = EXCLUDED.rating,
    follower_count  = EXCLUDED.follower_count,
    updated_at      = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_seller_profile_from_instagram()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.seller_profiles
  SET instagram_username = NEW.instagram_handle,
      updated_at = NOW()
  WHERE store_id = NEW.store_id;
  RETURN NEW;
END;
$$;

-- product_count sync
CREATE OR REPLACE FUNCTION public.sync_seller_profile_product_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seller_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_seller_id := OLD.seller_id;
  ELSE
    v_seller_id := NEW.seller_id;
  END IF;

  UPDATE public.seller_profiles
  SET product_count = (
    SELECT COUNT(*) FROM public.listings
    WHERE seller_id = v_seller_id AND status = 'active'
  ),
  updated_at = NOW()
  WHERE seller_id = v_seller_id;
  RETURN NULL;
END;
$$;

-- Triggers
DROP TRIGGER IF EXISTS trg_sync_seller_profile_store ON public.stores;
CREATE TRIGGER trg_sync_seller_profile_store
  AFTER INSERT OR UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.sync_seller_profile_from_store();

DROP TRIGGER IF EXISTS trg_sync_seller_profile_instagram ON public.instagram_accounts;
CREATE TRIGGER trg_sync_seller_profile_instagram
  AFTER INSERT OR UPDATE ON public.instagram_accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_seller_profile_from_instagram();

DROP TRIGGER IF EXISTS trg_sync_seller_profile_product_count ON public.listings;
CREATE TRIGGER trg_sync_seller_profile_product_count
  AFTER INSERT OR UPDATE OR DELETE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.sync_seller_profile_product_count();

-- ── Backfill existing stores ─────────────────────────────────────────────────
INSERT INTO public.seller_profiles (
  seller_id, store_id, store_name, bio, city, verified_seller,
  rating, follower_count, updated_at
)
SELECT
  s.seller_id, s.id, s.name, s.description, s.city,
  COALESCE(s.is_verified, false),
  COALESCE(s.rating, 0), COALESCE(s.follower_count, 0), NOW()
FROM public.stores s
ON CONFLICT (seller_id) DO UPDATE SET
  store_id        = EXCLUDED.store_id,
  store_name      = EXCLUDED.store_name,
  bio             = EXCLUDED.bio,
  city            = EXCLUDED.city,
  verified_seller = EXCLUDED.verified_seller,
  rating          = EXCLUDED.rating,
  follower_count  = EXCLUDED.follower_count,
  updated_at      = NOW();

-- Backfill instagram handles
UPDATE public.seller_profiles sp
SET instagram_username = ia.instagram_handle
FROM public.instagram_accounts ia
WHERE ia.store_id = sp.store_id;

-- Backfill product counts
UPDATE public.seller_profiles sp
SET product_count = (
  SELECT COUNT(*) FROM public.listings l
  WHERE l.seller_id = sp.seller_id AND l.status = 'active'
);

-- ── search_stores_rpc ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_stores_rpc(
  p_query     TEXT    DEFAULT NULL,
  p_category  TEXT    DEFAULT NULL,
  p_city      TEXT    DEFAULT NULL,
  p_sort      TEXT    DEFAULT 'relevance',
  p_page      INT     DEFAULT 1,
  p_page_size INT     DEFAULT 20
)
RETURNS TABLE (
  store_id           UUID,
  seller_id          UUID,
  store_name         TEXT,
  instagram_username TEXT,
  bio                TEXT,
  city               TEXT,
  category           TEXT,
  verified_seller    BOOLEAN,
  rating             NUMERIC,
  follower_count     INT,
  product_count      INT,
  avatar_url         TEXT,
  instagram_priority BOOLEAN
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_clean_query TEXT;
  v_is_instagram BOOLEAN := false;
BEGIN
  -- strip leading @ for instagram search
  IF p_query IS NOT NULL AND LEFT(p_query, 1) = '@' THEN
    v_is_instagram := true;
    v_clean_query := LOWER(TRIM(SUBSTRING(p_query FROM 2)));
  ELSIF p_query IS NOT NULL THEN
    v_clean_query := LOWER(TRIM(p_query));
  END IF;

  RETURN QUERY
  SELECT
    sp.store_id,
    sp.seller_id,
    sp.store_name,
    sp.instagram_username,
    sp.bio,
    sp.city,
    sp.category,
    sp.verified_seller,
    sp.rating,
    sp.follower_count,
    sp.product_count,
    p.avatar_url,
    CASE
      WHEN v_is_instagram AND sp.instagram_username IS NOT NULL
        AND LOWER(sp.instagram_username) LIKE ('%' || v_clean_query || '%')
      THEN true
      ELSE false
    END AS instagram_priority
  FROM public.seller_profiles sp
  LEFT JOIN public.profiles p ON p.id = sp.seller_id
  LEFT JOIN public.stores st ON st.id = sp.store_id
  WHERE
    -- only active stores
    (st.id IS NULL OR st.is_active = true)
    -- query filter
    AND (
      v_clean_query IS NULL
      OR (v_is_instagram AND sp.instagram_username ILIKE '%' || v_clean_query || '%')
      OR (NOT v_is_instagram AND (
            sp.store_name ILIKE '%' || v_clean_query || '%'
         OR sp.instagram_username ILIKE '%' || v_clean_query || '%'
         OR sp.bio ILIKE '%' || v_clean_query || '%'
         ))
    )
    -- category filter
    AND (p_category IS NULL OR sp.category = p_category)
    -- city filter
    AND (p_city IS NULL OR sp.city ILIKE p_city)
  ORDER BY
    CASE WHEN v_is_instagram AND sp.instagram_username ILIKE '%' || v_clean_query || '%' THEN 0 ELSE 1 END,
    CASE p_sort
      WHEN 'rating'         THEN sp.rating
      WHEN 'most_followers' THEN sp.follower_count::NUMERIC
      WHEN 'most_products'  THEN sp.product_count::NUMERIC
      ELSE sp.follower_count::NUMERIC
    END DESC,
    sp.verified_seller DESC
  LIMIT p_page_size
  OFFSET (p_page - 1) * p_page_size;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_stores_rpc TO anon, authenticated;
