-- ============================================================
-- 039_story_expiration_and_rls.sql
-- Story expiration logic and comprehensive RLS policies
-- Hikaye sona erme mantığı ve RLS politikaları
-- ============================================================

-- ============================================================
-- STORY EXPIRATION TRIGGERS
-- ============================================================

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

UPDATE public.stories
SET owner_id = user_id
WHERE owner_id IS NULL;

CREATE OR REPLACE FUNCTION sync_story_owner_fields()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.owner_id = COALESCE(NEW.owner_id, NEW.user_id, auth.uid());
  NEW.user_id = COALESCE(NEW.user_id, NEW.owner_id, auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stories_sync_owner_fields ON public.stories;
CREATE TRIGGER stories_sync_owner_fields
  BEFORE INSERT OR UPDATE ON public.stories
  FOR EACH ROW
  EXECUTE FUNCTION sync_story_owner_fields();

-- Auto-expire stories after 24 hours
CREATE OR REPLACE FUNCTION auto_expire_stories()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.stories
  SET is_archived = true
  WHERE expires_at < NOW()
    AND is_archived = false;
END;
$$;

-- Trigger function to set expiration on story creation
CREATE OR REPLACE FUNCTION set_story_expiration()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.expires_at = NOW() + INTERVAL '24 hours';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stories_set_expiration ON public.stories;
CREATE TRIGGER stories_set_expiration
  BEFORE INSERT ON public.stories
  FOR EACH ROW
  EXECUTE FUNCTION set_story_expiration();

-- ============================================================
-- STORY VISIBILITY FUNCTION
-- Kullanıcının hikaye görebilmesi için mantık
-- ============================================================

CREATE OR REPLACE FUNCTION user_can_view_story(p_user_id UUID, p_story_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_story_user_id UUID;
  v_is_expired BOOLEAN;
  v_is_archived BOOLEAN;
BEGIN
  SELECT COALESCE(owner_id, user_id), expires_at < NOW(), is_archived
  INTO v_story_user_id, v_is_expired, v_is_archived
  FROM public.stories
  WHERE id = p_story_id;

  -- Hikaye yoksa false döndür
  IF v_story_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Süresi dolmuş veya arşivlenmiş hikayeler görülemez
  IF v_is_expired OR v_is_archived THEN
    RETURN false;
  END IF;

  -- Hikaye sahibi kendi hikayesini görebilir
  IF p_user_id = v_story_user_id THEN
    RETURN true;
  END IF;

  -- Diğer kullanıcılar mağaza hikayelerini görebilir (public)
  RETURN true;
END;
$$;

-- ============================================================
-- COMPREHENSIVE RLS POLICIES
-- ============================================================

-- Drop existing policies for stories table if they exist
DROP POLICY IF EXISTS "stories_read_all" ON public.stories;
DROP POLICY IF EXISTS "stories_create_own" ON public.stories;
DROP POLICY IF EXISTS "stories_update_own" ON public.stories;
DROP POLICY IF EXISTS "stories_delete_own" ON public.stories;
DROP POLICY IF EXISTS "stories_read_active" ON public.stories;

-- Stories table RLS
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- READ: Users can view non-expired, non-archived stories
CREATE POLICY "stories_read_active"
  ON public.stories FOR SELECT
  USING (
    expires_at > NOW() AND is_archived = false
  );

-- CREATE: Authenticated users can create their own stories
CREATE POLICY "stories_create_own"
  ON public.stories FOR INSERT
  WITH CHECK (
    auth.uid() = COALESCE(owner_id, user_id) AND
    auth.uid() IS NOT NULL
  );

-- UPDATE: Users can update their own stories
CREATE POLICY "stories_update_own"
  ON public.stories FOR UPDATE
  USING (
    auth.uid() = COALESCE(owner_id, user_id)
  )
  WITH CHECK (
    auth.uid() = COALESCE(owner_id, user_id)
  );

-- DELETE: Users can delete their own stories
CREATE POLICY "stories_delete_own"
  ON public.stories FOR DELETE
  USING (
    auth.uid() = COALESCE(owner_id, user_id)
  );

-- ============================================================
-- STORY PRODUCTS TABLE RLS
-- ============================================================

ALTER TABLE public.story_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "story_products_read_all" ON public.story_products;
DROP POLICY IF EXISTS "story_products_manage_own" ON public.story_products;
DROP POLICY IF EXISTS "story_products_read_if_story_visible" ON public.story_products;
DROP POLICY IF EXISTS "story_products_create_own_story" ON public.story_products;
DROP POLICY IF EXISTS "story_products_update_own_story" ON public.story_products;
DROP POLICY IF EXISTS "story_products_delete_own_story" ON public.story_products;

-- READ: Anyone can read story product links if story is visible
CREATE POLICY "story_products_read_if_story_visible"
  ON public.story_products FOR SELECT
  USING (
    user_can_view_story(auth.uid(), story_id)
  );

-- CREATE: Story owner can link products
CREATE POLICY "story_products_create_own_story"
  ON public.story_products FOR INSERT
  WITH CHECK (
    auth.uid() = (
      SELECT COALESCE(owner_id, user_id) FROM public.stories WHERE id = story_id
    )
  );

-- UPDATE: Story owner can modify product links
CREATE POLICY "story_products_update_own_story"
  ON public.story_products FOR UPDATE
  USING (
    auth.uid() = (
      SELECT COALESCE(owner_id, user_id) FROM public.stories WHERE id = story_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT COALESCE(owner_id, user_id) FROM public.stories WHERE id = story_id
    )
  );

-- DELETE: Story owner can remove product links
CREATE POLICY "story_products_delete_own_story"
  ON public.story_products FOR DELETE
  USING (
    auth.uid() = (
      SELECT user_id FROM public.stories WHERE id = story_id
    )
  );

-- ============================================================
-- STORY VIEWS TABLE RLS
-- ============================================================

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "story_views_read_all" ON public.story_views;
DROP POLICY IF EXISTS "story_views_create_own" ON public.story_views;
DROP POLICY IF EXISTS "story_views_read_own_story" ON public.story_views;

-- READ: Users can see views on their own stories
CREATE POLICY "story_views_read_own_story"
  ON public.story_views FOR SELECT
  USING (
    auth.uid() = (
      SELECT COALESCE(owner_id, user_id) FROM public.stories WHERE id = story_id
    )
  );

-- CREATE: Users can record their own view
CREATE POLICY "story_views_create_own"
  ON public.story_views FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    user_can_view_story(user_id, story_id)
  );

-- ============================================================
-- STORY LIKES TABLE RLS
-- ============================================================

ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "story_likes_read_all" ON public.story_likes;
DROP POLICY IF EXISTS "story_likes_manage_own" ON public.story_likes;
DROP POLICY IF EXISTS "story_likes_read_if_story_visible" ON public.story_likes;
DROP POLICY IF EXISTS "story_likes_create_own" ON public.story_likes;
DROP POLICY IF EXISTS "story_likes_delete_own" ON public.story_likes;

-- READ: Anyone can see likes if story is visible
CREATE POLICY "story_likes_read_if_story_visible"
  ON public.story_likes FOR SELECT
  USING (
    user_can_view_story(auth.uid(), story_id)
  );

-- CREATE: Users can like visible stories
CREATE POLICY "story_likes_create_own"
  ON public.story_likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    user_can_view_story(user_id, story_id)
  );

-- DELETE: Users can unlike their own likes
CREATE POLICY "story_likes_delete_own"
  ON public.story_likes FOR DELETE
  USING (
    auth.uid() = user_id
  );

-- ============================================================
-- STORY COMMENTS TABLE RLS
-- ============================================================

ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "story_comments_read_all" ON public.story_comments;
DROP POLICY IF EXISTS "story_comments_manage_own" ON public.story_comments;
DROP POLICY IF EXISTS "story_comments_read_if_story_visible" ON public.story_comments;
DROP POLICY IF EXISTS "story_comments_create_on_visible" ON public.story_comments;
DROP POLICY IF EXISTS "story_comments_update_own" ON public.story_comments;
DROP POLICY IF EXISTS "story_comments_delete_own" ON public.story_comments;

-- READ: Anyone can read comments on visible stories
CREATE POLICY "story_comments_read_if_story_visible"
  ON public.story_comments FOR SELECT
  USING (
    user_can_view_story(auth.uid(), story_id)
  );

-- CREATE: Users can comment on visible stories
CREATE POLICY "story_comments_create_on_visible"
  ON public.story_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    user_can_view_story(user_id, story_id) AND
    char_length(trim(body)) > 0
  );

-- UPDATE: Users can edit their own comments
CREATE POLICY "story_comments_update_own"
  ON public.story_comments FOR UPDATE
  USING (
    auth.uid() = user_id
  )
  WITH CHECK (
    auth.uid() = user_id AND
    char_length(trim(body)) > 0
  );

-- DELETE: Users can delete their own comments
CREATE POLICY "story_comments_delete_own"
  ON public.story_comments FOR DELETE
  USING (
    auth.uid() = user_id
  );

-- ============================================================
-- STORY FEATURES TABLE RLS
-- ============================================================

ALTER TABLE public.story_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "story_features_manage_own" ON public.story_features;
DROP POLICY IF EXISTS "story_features_read_own_story" ON public.story_features;
DROP POLICY IF EXISTS "story_features_create_own_story" ON public.story_features;
DROP POLICY IF EXISTS "story_features_update_own_story" ON public.story_features;
DROP POLICY IF EXISTS "story_features_delete_own_story" ON public.story_features;

-- READ: Story owner can read their story's features
CREATE POLICY "story_features_read_own_story"
  ON public.story_features FOR SELECT
  USING (
    auth.uid() = (
      SELECT COALESCE(owner_id, user_id) FROM public.stories WHERE id = story_id
    )
  );

-- CREATE: Story owner can add features
CREATE POLICY "story_features_create_own_story"
  ON public.story_features FOR INSERT
  WITH CHECK (
    auth.uid() = (
      SELECT COALESCE(owner_id, user_id) FROM public.stories WHERE id = story_id
    )
  );

-- UPDATE: Story owner can update features
CREATE POLICY "story_features_update_own_story"
  ON public.story_features FOR UPDATE
  USING (
    auth.uid() = (
      SELECT COALESCE(owner_id, user_id) FROM public.stories WHERE id = story_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT COALESCE(owner_id, user_id) FROM public.stories WHERE id = story_id
    )
  );

-- DELETE: Story owner can remove features
CREATE POLICY "story_features_delete_own_story"
  ON public.story_features FOR DELETE
  USING (
    auth.uid() = (
      SELECT user_id FROM public.stories WHERE id = story_id
    )
  );

-- ============================================================
-- EXPLORE FEATURED STORIES TABLE RLS
-- ============================================================

ALTER TABLE public.explore_featured_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "explore_featured_stories_read_all" ON public.explore_featured_stories;
DROP POLICY IF EXISTS "explore_featured_stories_read_active" ON public.explore_featured_stories;

-- READ: Anyone can see active featured stories
CREATE POLICY "explore_featured_stories_read_active"
  ON public.explore_featured_stories FOR SELECT
  USING (
    is_active = true AND
    (expires_at IS NULL OR expires_at > NOW())
  );

-- ============================================================
-- SELLER LEADERBOARD TABLE RLS
-- ============================================================

ALTER TABLE public.seller_leaderboard ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seller_leaderboard_read_all" ON public.seller_leaderboard;

-- READ: Anyone can see the leaderboard
CREATE POLICY "seller_leaderboard_read_all"
  ON public.seller_leaderboard FOR SELECT
  USING (true);

-- ============================================================
-- UTILITY FUNCTIONS FOR EXPIRATION MANAGEMENT
-- ============================================================

-- Get active stories count
CREATE OR REPLACE FUNCTION count_active_stories()
RETURNS INTEGER LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.stories
  WHERE expires_at > NOW() AND is_archived = false;
$$;

-- Get user's active stories
CREATE OR REPLACE FUNCTION user_active_stories_count(p_user_id UUID)
RETURNS INTEGER LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.stories
  WHERE COALESCE(owner_id, user_id) = p_user_id
    AND expires_at > NOW()
    AND is_archived = false;
$$;

-- Archive expired stories (scheduled job)
CREATE OR REPLACE FUNCTION archive_expired_stories()
RETURNS TABLE(archived_count INT, total_active INT) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_archived INT;
  v_total INT;
BEGIN
  -- Archive expired stories
  UPDATE public.stories
  SET is_archived = true
  WHERE expires_at < NOW() AND is_archived = false;

  GET DIAGNOSTICS v_archived = ROW_COUNT;

  -- Get remaining active count
  SELECT COUNT(*)::INT INTO v_total
  FROM public.stories
  WHERE expires_at > NOW() AND is_archived = false;

  RETURN QUERY SELECT v_archived, v_total;
END;
$$;

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT EXECUTE ON FUNCTION user_can_view_story TO authenticated;
GRANT EXECUTE ON FUNCTION count_active_stories TO authenticated;
GRANT EXECUTE ON FUNCTION user_active_stories_count TO authenticated;
GRANT EXECUTE ON FUNCTION archive_expired_stories TO authenticated;

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS stories_expires_at_idx 
  ON public.stories(expires_at) 
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS stories_user_active_idx 
  ON public.stories(user_id, expires_at, is_archived)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS stories_owner_active_idx 
  ON public.stories(owner_id, expires_at, is_archived)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS story_views_story_user_idx 
  ON public.story_views(story_id, user_id);

CREATE INDEX IF NOT EXISTS story_likes_created_idx 
  ON public.story_likes(created_at DESC);

CREATE INDEX IF NOT EXISTS story_comments_story_created_idx 
  ON public.story_comments(story_id, created_at DESC);
