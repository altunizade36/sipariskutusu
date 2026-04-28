-- Explore tab seller ranking views and functions
-- Uses the project schema: profiles, stores, stories.user_id/owner_id, listings.

CREATE TABLE IF NOT EXISTS public.seller_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  context TEXT CHECK (context IN ('explore_featured', 'explore_grid', 'explore_stories', 'home')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.seller_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  context TEXT CHECK (context IN ('explore_featured', 'explore_grid', 'explore_stories', 'home')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_impressions_seller_id_time ON public.seller_impressions(seller_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_seller_impressions_user_id_time ON public.seller_impressions(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_seller_clicks_seller_id_time ON public.seller_clicks(seller_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_seller_clicks_user_id_time ON public.seller_clicks(user_id, timestamp DESC);

ALTER TABLE public.seller_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own impressions" ON public.seller_impressions;
CREATE POLICY "Users can insert their own impressions"
  ON public.seller_impressions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own clicks" ON public.seller_clicks;
CREATE POLICY "Users can insert their own clicks"
  ON public.seller_clicks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE VIEW public.seller_weekly_stats AS
WITH story_base AS (
  SELECT
    st.id,
    COALESCE(st.owner_id, st.user_id) AS seller_id,
    st.view_count,
    st.created_at
  FROM public.stories st
  WHERE st.created_at >= NOW() - INTERVAL '7 days'
    AND st.expires_at > NOW()
    AND COALESCE(st.is_archived, false) = false
), story_metrics AS (
  SELECT
    sb.seller_id,
    COUNT(DISTINCT sb.id) AS story_count,
    COUNT(DISTINCT sl.id) AS total_likes,
    COUNT(DISTINCT sc.id) AS total_comments,
    COALESCE(SUM(sb.view_count), 0) AS total_views,
    COUNT(DISTINCT sp.id) AS total_product_links
  FROM story_base sb
  LEFT JOIN public.story_likes sl ON sl.story_id = sb.id
  LEFT JOIN public.story_comments sc ON sc.story_id = sb.id
  LEFT JOIN public.story_products sp ON sp.story_id = sb.id
  GROUP BY sb.seller_id
)
SELECT
  p.id AS seller_id,
  p.full_name,
  p.avatar_url,
  COALESCE(sm.story_count, 0) AS story_count,
  COALESCE(sm.total_likes, 0) AS total_likes,
  COALESCE(sm.total_comments, 0) AS total_comments,
  COALESCE(sm.total_views, 0) AS total_views,
  COALESCE(sm.total_product_links, 0) AS total_product_links,
  (
    COALESCE(sm.total_likes, 0) * 5
    + COALESCE(sm.total_comments, 0) * 3
    + COALESCE(sm.total_views, 0) * 0.1
    + COALESCE(sm.total_product_links, 0) * 2
  )::FLOAT AS engagement_score,
  CASE
    WHEN (
      COALESCE(sm.total_likes, 0) * 5
      + COALESCE(sm.total_comments, 0) * 3
      + COALESCE(sm.total_views, 0) * 0.1
      + COALESCE(sm.total_product_links, 0) * 2
    ) >= 50000 THEN 'trending'
    WHEN (
      COALESCE(sm.total_likes, 0) * 5
      + COALESCE(sm.total_comments, 0) * 3
      + COALESCE(sm.total_views, 0) * 0.1
      + COALESCE(sm.total_product_links, 0) * 2
    ) >= 10000 THEN 'popular'
    WHEN (
      COALESCE(sm.total_likes, 0) * 5
      + COALESCE(sm.total_comments, 0) * 3
      + COALESCE(sm.total_views, 0) * 0.1
      + COALESCE(sm.total_product_links, 0) * 2
    ) >= 1000 THEN 'rising'
    ELSE 'new'
  END AS engagement_tier,
  NOW() AS last_updated
FROM public.profiles p
LEFT JOIN story_metrics sm ON sm.seller_id = p.id
WHERE p.is_seller = true;

CREATE OR REPLACE VIEW public.explore_trending_sellers AS
SELECT
  p.id AS seller_id,
  p.full_name,
  p.avatar_url,
  COALESCE(sto.name, p.full_name, 'Magaza') AS store_name,
  COALESCE(sto.avatar_url, p.avatar_url) AS store_avatar,
  sto.username AS store_slug,
  sws.engagement_score AS weekly_score,
  COALESCE(daily.daily_score, 0)::FLOAT AS daily_score,
  sws.story_count AS active_story_count,
  ROW_NUMBER() OVER (ORDER BY COALESCE(daily.daily_score, 0) DESC, sws.engagement_score DESC) AS daily_rank
FROM public.seller_weekly_stats sws
JOIN public.profiles p ON p.id = sws.seller_id
LEFT JOIN public.stores sto ON sto.seller_id = p.id AND sto.is_active = true
LEFT JOIN LATERAL (
  SELECT
    (
      COUNT(DISTINCT sl.id) * 5
      + COUNT(DISTINCT sc.id) * 3
      + COALESCE(SUM(s.view_count), 0) * 0.1
      + COUNT(DISTINCT sp.id) * 2
    ) AS daily_score
  FROM public.stories s
  LEFT JOIN public.story_likes sl ON sl.story_id = s.id
  LEFT JOIN public.story_comments sc ON sc.story_id = s.id
  LEFT JOIN public.story_products sp ON sp.story_id = s.id
  WHERE COALESCE(s.owner_id, s.user_id) = p.id
    AND s.created_at >= NOW() - INTERVAL '1 day'
    AND s.expires_at > NOW()
    AND COALESCE(s.is_archived, false) = false
) daily ON true
WHERE sws.story_count > 0 OR p.is_verified = true;

CREATE OR REPLACE FUNCTION public.get_seller_impression_count(p_seller_id UUID, p_days INT DEFAULT 7)
RETURNS TABLE(
  seller_id UUID,
  impressions BIGINT,
  clicks BIGINT,
  ctr FLOAT
) AS $$
WITH impression_stats AS (
  SELECT COUNT(*)::BIGINT AS impressions
  FROM public.seller_impressions
  WHERE seller_id = p_seller_id
    AND timestamp >= NOW() - (p_days || ' days')::INTERVAL
), click_stats AS (
  SELECT COUNT(*)::BIGINT AS clicks
  FROM public.seller_clicks
  WHERE seller_id = p_seller_id
    AND timestamp >= NOW() - (p_days || ' days')::INTERVAL
)
SELECT
  p_seller_id,
  i.impressions,
  c.clicks,
  CASE WHEN i.impressions > 0 THEN c.clicks::FLOAT / i.impressions::FLOAT ELSE 0 END
FROM impression_stats i, click_stats c;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION public.rank_explore_sellers(p_limit INT DEFAULT 24)
RETURNS TABLE(
  seller_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  store_name TEXT,
  store_slug TEXT,
  engagement_score FLOAT,
  engagement_tier TEXT,
  daily_rank INT,
  trend_direction TEXT,
  impressions BIGINT,
  click_through_rate FLOAT
) AS $$
WITH ranked AS (
  SELECT
    ets.seller_id,
    ets.full_name,
    ets.avatar_url,
    ets.store_name,
    ets.store_slug,
    ets.weekly_score AS engagement_score,
    CASE
      WHEN ets.weekly_score >= 50000 THEN 'trending'
      WHEN ets.weekly_score >= 10000 THEN 'popular'
      WHEN ets.weekly_score >= 1000 THEN 'rising'
      ELSE 'new'
    END AS engagement_tier,
    ets.daily_rank::INT,
    CASE
      WHEN ets.daily_score > ets.weekly_score * 0.5 THEN 'rising'
      WHEN ets.daily_score < ets.weekly_score * 0.2 THEN 'falling'
      ELSE 'stable'
    END AS trend_direction,
    si.impressions,
    si.ctr AS click_through_rate,
    ROW_NUMBER() OVER (ORDER BY ets.weekly_score DESC, ets.daily_rank ASC) AS row_rank
  FROM public.explore_trending_sellers ets
  LEFT JOIN public.get_seller_impression_count(ets.seller_id, 7) si ON true
)
SELECT
  seller_id,
  full_name,
  avatar_url,
  store_name,
  store_slug,
  engagement_score,
  engagement_tier,
  daily_rank,
  trend_direction,
  COALESCE(impressions, 0),
  COALESCE(click_through_rate, 0)
FROM ranked
WHERE row_rank <= p_limit
ORDER BY row_rank ASC;
$$ LANGUAGE SQL STABLE;