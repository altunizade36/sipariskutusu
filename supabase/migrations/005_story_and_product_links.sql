-- ============================================================
-- 005_story_and_product_links.sql
-- Story system and product-to-story linking
-- Hikaye sistemi ve ürün-hikaye ilişkilendirmesi
-- ============================================================

-- ============================================================
-- STORY SYSTEM ENHANCEMENTS
-- ============================================================

-- story_products - Hikayedeki ürün bağlantıları
CREATE TABLE IF NOT EXISTS public.story_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  action_type TEXT NOT NULL DEFAULT 'view' CHECK (action_type IN ('view', 'message', 'purchase')),
  link_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(story_id, listing_id)
);

CREATE INDEX IF NOT EXISTS story_products_story_idx ON public.story_products(story_id);
CREATE INDEX IF NOT EXISTS story_products_listing_idx ON public.story_products(listing_id);

-- story_views - Hikaye görüntüleme takibi
CREATE TABLE IF NOT EXISTS public.story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(story_id, user_id)
);

CREATE INDEX IF NOT EXISTS story_views_story_idx ON public.story_views(story_id);
CREATE INDEX IF NOT EXISTS story_views_user_idx ON public.story_views(user_id);

-- story_likes - Hikaye beğenileri (already exists, reinforce)
CREATE TABLE IF NOT EXISTS public.story_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(story_id, user_id)
);

CREATE INDEX IF NOT EXISTS story_likes_story_idx ON public.story_likes(story_id);
CREATE INDEX IF NOT EXISTS story_likes_user_idx ON public.story_likes(user_id);

-- story_comments - Hikaye yorumları (already exists, reinforce)
CREATE TABLE IF NOT EXISTS public.story_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS story_comments_story_idx ON public.story_comments(story_id);
CREATE INDEX IF NOT EXISTS story_comments_user_idx ON public.story_comments(user_id);

-- ============================================================
-- STORY FEATURES TABLE - Hikaye özelliklerini saklama
-- ============================================================

CREATE TABLE IF NOT EXISTS public.story_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  feature_type TEXT NOT NULL,
  feature_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS story_features_story_idx ON public.story_features(story_id);

-- ============================================================
-- EXPLORE PAGE STORIES - Sistem/admin tarafından yönetilen hikayeler
-- ============================================================

CREATE TABLE IF NOT EXISTS public.explore_featured_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  featured_type TEXT NOT NULL DEFAULT 'daily' CHECK (featured_type IN ('daily', 'weekly', 'trending')),
  popularity_score NUMERIC(10,2) NOT NULL DEFAULT 0,
  featured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS explore_featured_stories_seller_idx 
  ON public.explore_featured_stories(seller_id);

CREATE INDEX IF NOT EXISTS explore_featured_stories_type_idx 
  ON public.explore_featured_stories(featured_type);

CREATE INDEX IF NOT EXISTS explore_featured_stories_active_idx 
  ON public.explore_featured_stories(is_active, expires_at);

-- ============================================================
-- SELLER LEADERBOARD - Satıcı sıralaması
-- ============================================================

CREATE TABLE IF NOT EXISTS public.seller_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  leaderboard_type TEXT NOT NULL CHECK (leaderboard_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  rank INT NOT NULL,
  score NUMERIC(15,2) NOT NULL,
  metric_breakdown JSONB,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(seller_id, leaderboard_type, period_start)
);

CREATE INDEX IF NOT EXISTS seller_leaderboard_type_idx 
  ON public.seller_leaderboard(leaderboard_type);

CREATE INDEX IF NOT EXISTS seller_leaderboard_rank_idx 
  ON public.seller_leaderboard(rank);

-- ============================================================
-- RLS POLICIES - Story Tables
-- ============================================================

ALTER TABLE public.story_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.explore_featured_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_leaderboard ENABLE ROW LEVEL SECURITY;

-- story_products - Her yerde okunabilir
CREATE POLICY "story_products_read_all"
  ON public.story_products FOR SELECT
  USING (true);

-- story_products - Satıcı yönetir
CREATE POLICY "story_products_manage_own"
  ON public.story_products FOR ALL
  USING (
    auth.uid() = (
      SELECT user_id FROM public.stories WHERE id = story_id
    )
  );

-- story_views - Herkes okuyabilir
CREATE POLICY "story_views_read_all"
  ON public.story_views FOR SELECT
  USING (true);

-- story_views - Kullanıcı kendi görüntülemesini ekleyebilir
CREATE POLICY "story_views_create_own"
  ON public.story_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- story_likes - Herkes okuyabilir
CREATE POLICY "story_likes_read_all"
  ON public.story_likes FOR SELECT
  USING (true);

-- story_likes - Kullanıcı kendi beğenisini yönetir
CREATE POLICY "story_likes_manage_own"
  ON public.story_likes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- story_comments - Herkes okuyabilir
CREATE POLICY "story_comments_read_all"
  ON public.story_comments FOR SELECT
  USING (true);

-- story_comments - Kullanıcı kendi yorumunu yönetir
CREATE POLICY "story_comments_manage_own"
  ON public.story_comments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- story_features - Hikaye sahibi yönetir
CREATE POLICY "story_features_manage_own"
  ON public.story_features FOR ALL
  USING (
    auth.uid() = (
      SELECT user_id FROM public.stories WHERE id = story_id
    )
  );

-- explore_featured_stories - Herkes okuyabilir
CREATE POLICY "explore_featured_stories_read_all"
  ON public.explore_featured_stories FOR SELECT
  USING (true);

-- seller_leaderboard - Herkes okuyabilir
CREATE POLICY "seller_leaderboard_read_all"
  ON public.seller_leaderboard FOR SELECT
  USING (true);

-- ============================================================
-- HELPER FUNCTIONS - Yardımcı fonksiyonlar
-- ============================================================

-- Hikaye görüntüleme sayısı artır
CREATE OR REPLACE FUNCTION increment_story_view_count(p_story_id UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE public.stories 
  SET view_count = view_count + 1 
  WHERE id = p_story_id;
$$;

-- Popülerlik puanı hesapla (Explore için)
CREATE OR REPLACE FUNCTION calculate_story_popularity_score(p_story_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_likes INT := 0;
  v_comments INT := 0;
  v_views INT := 0;
  v_products INT := 0;
  v_score NUMERIC;
BEGIN
  SELECT COALESCE(COUNT(*), 0) INTO v_likes
  FROM public.story_likes WHERE story_id = p_story_id;

  SELECT COALESCE(COUNT(*), 0) INTO v_comments
  FROM public.story_comments WHERE story_id = p_story_id;

  SELECT COALESCE(view_count, 0) INTO v_views
  FROM public.stories WHERE id = p_story_id;

  SELECT COALESCE(COUNT(*), 0) INTO v_products
  FROM public.story_products WHERE story_id = p_story_id;

  v_score := (v_likes * 5) + (v_comments * 3) + (v_views::NUMERIC / 10) + (v_products * 2);

  RETURN v_score;
END;
$$;

-- Satıcı puanı güncelle (leaderboard için)
CREATE OR REPLACE FUNCTION update_seller_leaderboard_score(p_seller_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_likes INT := 0;
  v_favorites INT := 0;
  v_messages INT := 0;
  v_views INT := 0;
  v_followers INT := 0;
  v_rating NUMERIC := 0;
  v_score NUMERIC;
BEGIN
  -- Beğeniler
  SELECT COALESCE(COUNT(*), 0) INTO v_likes
  FROM public.story_likes
  WHERE story_id IN (
    SELECT id FROM public.stories WHERE user_id = p_seller_id
  );

  -- Favoriler
  SELECT COALESCE(SUM(favorite_count), 0) INTO v_favorites
  FROM public.listings WHERE seller_id = p_seller_id AND status = 'active';

  -- Mesajlar
  SELECT COALESCE(COUNT(*), 0) INTO v_messages
  FROM public.messages
  WHERE conversation_id IN (
    SELECT id FROM public.conversations WHERE seller_id = p_seller_id
  );

  -- İlan görüntülemeleri
  SELECT COALESCE(SUM(view_count), 0) INTO v_views
  FROM public.listings WHERE seller_id = p_seller_id;

  -- Mağaza takipçileri
  SELECT COALESCE(follower_count, 0) INTO v_followers
  FROM public.stores WHERE seller_id = p_seller_id;

  -- Rating
  SELECT COALESCE(rating, 0) INTO v_rating
  FROM public.profiles WHERE id = p_seller_id;

  v_score := (v_likes * 5) + (v_favorites * 3) + (v_messages * 2) + 
             (v_views::NUMERIC / 10) + (v_followers * 2) + (v_rating * 10);

  RETURN v_score;
END;
$$;

-- ============================================================
-- TRIGGERS - Otomatik işlemler
-- ============================================================

-- Story popülaritesi güncellenince leaderboard'u güncelle
CREATE OR REPLACE FUNCTION update_leaderboard_on_story_engagement()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.seller_leaderboard
  SET score = calculate_seller_leaderboard_score(
    (SELECT user_id FROM public.stories WHERE id = NEW.story_id)
  )
  WHERE seller_id = (SELECT user_id FROM public.stories WHERE id = NEW.story_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS story_engagement_leaderboard_update ON public.story_likes;
CREATE TRIGGER story_engagement_leaderboard_update
  AFTER INSERT ON public.story_likes
  FOR EACH ROW EXECUTE FUNCTION update_leaderboard_on_story_engagement();

-- ============================================================
-- MATERIALIZED VIEW - Haftanın popüler satıcıları
-- ============================================================

CREATE OR REPLACE VIEW public.weekly_popular_sellers AS
SELECT 
  p.id,
  p.full_name,
  p.avatar_url,
  s.name as store_name,
  COUNT(DISTINCT sl.user_id) as unique_likers,
  COUNT(DISTINCT sc.user_id) as unique_commenters,
  SUM(st.view_count) as total_story_views,
  AVG(p.rating) as avg_rating,
  calculate_seller_leaderboard_score(p.id) as popularity_score
FROM public.profiles p
LEFT JOIN public.stores s ON s.seller_id = p.id
LEFT JOIN public.stories st ON st.user_id = p.id AND st.created_at >= NOW() - INTERVAL '7 days'
LEFT JOIN public.story_likes sl ON sl.story_id = st.id
LEFT JOIN public.story_comments sc ON sc.story_id = st.id
WHERE p.is_seller = true
GROUP BY p.id, p.full_name, p.avatar_url, s.name
ORDER BY popularity_score DESC
LIMIT 50;

-- ============================================================
-- GRANTS - Yetkiler
-- ============================================================

GRANT EXECUTE ON FUNCTION increment_story_view_count TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_story_popularity_score TO authenticated;
GRANT EXECUTE ON FUNCTION update_seller_leaderboard_score TO authenticated;
