-- ============================================================
-- 040_story_engagement_functions.sql
-- Story engagement tracking and leaderboard calculations
-- Hikaye etkileşimi takibi ve leaderboard hesaplamaları
-- ============================================================

-- ============================================================
-- STORY ENGAGEMENT METRICS
-- ============================================================

-- Get story engagement stats
CREATE OR REPLACE FUNCTION get_story_engagement(p_story_id UUID)
RETURNS TABLE(
  like_count BIGINT,
  comment_count BIGINT,
  view_count BIGINT,
  product_link_count BIGINT,
  engagement_score NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_likes BIGINT;
  v_comments BIGINT;
  v_views BIGINT;
  v_products BIGINT;
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

  -- Engagement score formula:
  -- Likes (5 points) + Comments (3 points) + Views (0.1 points) + Products (2 points)
  v_score := (v_likes * 5) + (v_comments * 3) + (v_views * 0.1) + (v_products * 2);

  RETURN QUERY SELECT v_likes, v_comments, v_views, v_products, v_score;
END;
$$;

-- Get seller engagement summary
CREATE OR REPLACE FUNCTION get_seller_engagement_summary(p_seller_id UUID, p_days INT DEFAULT 7)
RETURNS TABLE(
  total_stories INT,
  total_likes BIGINT,
  total_comments BIGINT,
  total_views BIGINT,
  avg_engagement_score NUMERIC,
  most_popular_story_id UUID,
  most_popular_story_score NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total_stories INT;
  v_total_likes BIGINT;
  v_total_comments BIGINT;
  v_total_views BIGINT;
  v_avg_score NUMERIC;
  v_best_story_id UUID;
  v_best_score NUMERIC;
BEGIN
  SELECT COUNT(*)::INT INTO v_total_stories
  FROM public.stories
  WHERE user_id = p_seller_id
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL
    AND is_archived = false;

  SELECT COALESCE(COUNT(*), 0) INTO v_total_likes
  FROM public.story_likes
  WHERE story_id IN (
    SELECT id FROM public.stories
    WHERE user_id = p_seller_id
      AND created_at >= NOW() - (p_days || ' days')::INTERVAL
  );

  SELECT COALESCE(COUNT(*), 0) INTO v_total_comments
  FROM public.story_comments
  WHERE story_id IN (
    SELECT id FROM public.stories
    WHERE user_id = p_seller_id
      AND created_at >= NOW() - (p_days || ' days')::INTERVAL
  );

  SELECT COALESCE(SUM(view_count), 0) INTO v_total_views
  FROM public.stories
  WHERE user_id = p_seller_id
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;

  -- Average engagement score
  SELECT AVG(score.engagement_score) INTO v_avg_score
  FROM (
    SELECT (eng.like_count * 5 + eng.comment_count * 3 + eng.view_count * 0.1 + eng.product_link_count * 2) as engagement_score
    FROM public.stories s
    CROSS JOIN LATERAL get_story_engagement(s.id) eng
    WHERE s.user_id = p_seller_id
      AND s.created_at >= NOW() - (p_days || ' days')::INTERVAL
  ) score;

  -- Best performing story
  SELECT s.id, (eng.like_count * 5 + eng.comment_count * 3 + eng.view_count * 0.1 + eng.product_link_count * 2)
  INTO v_best_story_id, v_best_score
  FROM public.stories s
  CROSS JOIN LATERAL get_story_engagement(s.id) eng
  WHERE s.user_id = p_seller_id
    AND s.created_at >= NOW() - (p_days || ' days')::INTERVAL
  ORDER BY (eng.like_count * 5 + eng.comment_count * 3 + eng.view_count * 0.1 + eng.product_link_count * 2) DESC
  LIMIT 1;

  RETURN QUERY SELECT v_total_stories, v_total_likes, v_total_comments, v_total_views, v_avg_score, v_best_story_id, v_best_score;
END;
$$;

-- ============================================================
-- LEADERBOARD CALCULATION & UPDATES
-- ============================================================

-- Calculate seller leaderboard rank for today
CREATE OR REPLACE FUNCTION calculate_daily_leaderboard()
RETURNS TABLE(seller_id UUID, rank INT, score NUMERIC) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
BEGIN
  v_period_start := DATE_TRUNC('day', NOW());
  v_period_end := v_period_start + INTERVAL '1 day';

  -- Clear existing daily leaderboard
  DELETE FROM public.seller_leaderboard
  WHERE leaderboard_type = 'daily' AND period_start = v_period_start;

  -- Insert new daily rankings
  INSERT INTO public.seller_leaderboard (
    seller_id,
    leaderboard_type,
    rank,
    score,
    metric_breakdown,
    period_start,
    period_end
  )
  SELECT
    p.id,
    'daily',
    ROW_NUMBER() OVER (ORDER BY score DESC),
    score,
    jsonb_build_object(
      'likes', likes,
      'comments', comments,
      'views', views,
      'products', products
    ),
    v_period_start,
    v_period_end
  FROM (
    SELECT
      p.id,
      COALESCE(COUNT(DISTINCT sl.id), 0) as likes,
      COALESCE(COUNT(DISTINCT sc.id), 0) as comments,
      COALESCE(SUM(s.view_count), 0) as views,
      COALESCE(COUNT(DISTINCT sp.id), 0) as products,
      (COALESCE(COUNT(DISTINCT sl.id), 0) * 5) +
      (COALESCE(COUNT(DISTINCT sc.id), 0) * 3) +
      (COALESCE(SUM(s.view_count), 0) * 0.1) +
      (COALESCE(COUNT(DISTINCT sp.id), 0) * 2) as score
    FROM public.profiles p
    LEFT JOIN public.stories s ON s.user_id = p.id AND s.created_at >= v_period_start AND s.created_at < v_period_end
    LEFT JOIN public.story_likes sl ON sl.story_id = s.id
    LEFT JOIN public.story_comments sc ON sc.story_id = s.id
    LEFT JOIN public.story_products sp ON sp.story_id = s.id
    WHERE p.is_seller = true
    GROUP BY p.id
  ) ranked;

  RETURN QUERY SELECT seller_id, rank, score FROM seller_leaderboard WHERE leaderboard_type = 'daily' AND period_start = v_period_start;
END;
$$;

-- Calculate seller leaderboard rank for this week
CREATE OR REPLACE FUNCTION calculate_weekly_leaderboard()
RETURNS TABLE(seller_id UUID, rank INT, score NUMERIC) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
BEGIN
  v_period_start := DATE_TRUNC('week', NOW());
  v_period_end := v_period_start + INTERVAL '7 days';

  -- Clear existing weekly leaderboard
  DELETE FROM public.seller_leaderboard
  WHERE leaderboard_type = 'weekly' AND period_start = v_period_start;

  -- Insert new weekly rankings
  INSERT INTO public.seller_leaderboard (
    seller_id,
    leaderboard_type,
    rank,
    score,
    metric_breakdown,
    period_start,
    period_end
  )
  SELECT
    p.id,
    'weekly',
    ROW_NUMBER() OVER (ORDER BY score DESC),
    score,
    jsonb_build_object(
      'likes', likes,
      'comments', comments,
      'views', views,
      'products', products
    ),
    v_period_start,
    v_period_end
  FROM (
    SELECT
      p.id,
      COALESCE(COUNT(DISTINCT sl.id), 0) as likes,
      COALESCE(COUNT(DISTINCT sc.id), 0) as comments,
      COALESCE(SUM(s.view_count), 0) as views,
      COALESCE(COUNT(DISTINCT sp.id), 0) as products,
      (COALESCE(COUNT(DISTINCT sl.id), 0) * 5) +
      (COALESCE(COUNT(DISTINCT sc.id), 0) * 3) +
      (COALESCE(SUM(s.view_count), 0) * 0.1) +
      (COALESCE(COUNT(DISTINCT sp.id), 0) * 2) as score
    FROM public.profiles p
    LEFT JOIN public.stories s ON s.user_id = p.id AND s.created_at >= v_period_start AND s.created_at < v_period_end
    LEFT JOIN public.story_likes sl ON sl.story_id = s.id
    LEFT JOIN public.story_comments sc ON sc.story_id = s.id
    LEFT JOIN public.story_products sp ON sp.story_id = s.id
    WHERE p.is_seller = true
    GROUP BY p.id
  ) ranked;

  RETURN QUERY SELECT seller_id, rank, score FROM seller_leaderboard WHERE leaderboard_type = 'weekly' AND period_start = v_period_start;
END;
$$;

-- ============================================================
-- MATERIALIZED VIEW - TOP SELLERS THIS WEEK
-- ============================================================

CREATE OR REPLACE VIEW public.top_sellers_weekly AS
SELECT
  p.id as seller_id,
  p.full_name,
  p.avatar_url,
  s.name as store_name,
  s.avatar_url as store_avatar,
  sl.rank,
  sl.score,
  (sl.metric_breakdown->>'likes')::INT as likes,
  (sl.metric_breakdown->>'comments')::INT as comments,
  (sl.metric_breakdown->>'views')::INT as views,
  (sl.metric_breakdown->>'products')::INT as products,
  COUNT(DISTINCT st.id) as active_stories
FROM public.seller_leaderboard sl
LEFT JOIN public.profiles p ON p.id = sl.seller_id
LEFT JOIN public.stores s ON s.seller_id = p.id
LEFT JOIN public.stories st ON st.user_id = p.id AND st.is_archived = false
WHERE sl.leaderboard_type = 'weekly'
  AND sl.period_start = DATE_TRUNC('week', NOW())
GROUP BY p.id, p.full_name, p.avatar_url, s.name, s.avatar_url, sl.rank, sl.score, sl.metric_breakdown
ORDER BY sl.rank ASC
LIMIT 50;

-- ============================================================
-- TOP STORIES VIEW
-- ============================================================

CREATE OR REPLACE VIEW public.top_stories_trending AS
SELECT
  s.id,
  s.user_id as seller_id,
  p.full_name as seller_name,
  p.avatar_url as seller_avatar,
  s.image_url,
  s.caption,
  s.created_at,
  s.expires_at,
  COUNT(DISTINCT sl.id) as like_count,
  COUNT(DISTINCT sc.id) as comment_count,
  s.view_count,
  COUNT(DISTINCT sp.id) as product_count,
  (COUNT(DISTINCT sl.id) * 5 + COUNT(DISTINCT sc.id) * 3 + s.view_count * 0.1 + COUNT(DISTINCT sp.id) * 2) as engagement_score
FROM public.stories s
LEFT JOIN public.profiles p ON p.id = s.user_id
LEFT JOIN public.story_likes sl ON sl.story_id = s.id
LEFT JOIN public.story_comments sc ON sc.story_id = s.id
LEFT JOIN public.story_products sp ON sp.story_id = s.id
WHERE s.expires_at > NOW()
  AND s.is_archived = false
GROUP BY s.id, s.user_id, p.full_name, p.avatar_url, s.image_url, s.caption, s.created_at, s.expires_at, s.view_count
ORDER BY engagement_score DESC
LIMIT 100;

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT EXECUTE ON FUNCTION get_story_engagement TO authenticated;
GRANT EXECUTE ON FUNCTION get_seller_engagement_summary TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_daily_leaderboard TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_weekly_leaderboard TO authenticated;

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS seller_leaderboard_daily_idx 
  ON public.seller_leaderboard(leaderboard_type, period_start DESC)
  WHERE leaderboard_type = 'daily';

CREATE INDEX IF NOT EXISTS seller_leaderboard_weekly_idx 
  ON public.seller_leaderboard(leaderboard_type, period_start DESC)
  WHERE leaderboard_type = 'weekly';

CREATE INDEX IF NOT EXISTS seller_leaderboard_rank_score_idx 
  ON public.seller_leaderboard(rank, score DESC);
