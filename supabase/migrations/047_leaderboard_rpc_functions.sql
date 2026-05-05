-- Missing RPC functions and views for the leaderboard service
-- Called by leaderboardService.ts: get_daily_leaderboard_with_rank, get_weekly_leaderboard_with_rank,
-- daily_seller_leaderboard view, weekly_seller_leaderboard view,
-- refresh_daily_leaderboard, refresh_weekly_leaderboard

-- ─────────────────────────────────────────────────────────────────
-- Helper: compute rank_trend by comparing current rank to previous
-- period's rank stored in seller_leaderboard table
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_daily_leaderboard_with_rank(
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  seller_id      UUID,
  full_name      TEXT,
  avatar_url     TEXT,
  store_name     TEXT,
  verified       BOOLEAN,
  daily_rank     INT,
  daily_score    NUMERIC,
  daily_likes    BIGINT,
  daily_comments BIGINT,
  daily_views    BIGINT,
  daily_products BIGINT,
  rank_trend     TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH today AS (
    SELECT
      sl.seller_id,
      sl.rank AS daily_rank,
      sl.score AS daily_score,
      COALESCE((sl.metric_breakdown->>'likes')::BIGINT, 0)    AS daily_likes,
      COALESCE((sl.metric_breakdown->>'comments')::BIGINT, 0) AS daily_comments,
      COALESCE((sl.metric_breakdown->>'views')::BIGINT, 0)    AS daily_views,
      COALESCE((sl.metric_breakdown->>'activity')::BIGINT, 0) AS daily_products
    FROM public.seller_leaderboard sl
    WHERE sl.leaderboard_type = 'daily'
      AND sl.period_start = public.leaderboard_period_start('daily', NOW())
  ),
  yesterday AS (
    SELECT
      sl.seller_id,
      sl.rank AS prev_rank
    FROM public.seller_leaderboard sl
    WHERE sl.leaderboard_type = 'daily'
      AND sl.period_start = public.leaderboard_period_start('daily', NOW()) - INTERVAL '1 day'
  )
  SELECT
    p.id            AS seller_id,
    p.full_name,
    p.avatar_url,
    COALESCE(s.name, p.full_name) AS store_name,
    COALESCE(s.is_verified, false)      AS verified,
    t.daily_rank,
    t.daily_score,
    t.daily_likes,
    t.daily_comments,
    t.daily_views,
    t.daily_products,
    CASE
      WHEN y.prev_rank IS NULL                THEN 'new'
      WHEN t.daily_rank < y.prev_rank          THEN 'rising'
      WHEN t.daily_rank > y.prev_rank          THEN 'falling'
      ELSE 'stable'
    END::TEXT AS rank_trend
  FROM today t
  JOIN public.profiles p  ON p.id = t.seller_id
  LEFT JOIN public.stores s ON s.seller_id = p.id AND s.is_active = true
  LEFT JOIN yesterday y   ON y.seller_id = t.seller_id
  ORDER BY t.daily_rank ASC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard_with_rank(
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  seller_id       UUID,
  full_name       TEXT,
  avatar_url      TEXT,
  store_name      TEXT,
  verified        BOOLEAN,
  weekly_rank     INT,
  weekly_score    NUMERIC,
  weekly_likes    BIGINT,
  weekly_comments BIGINT,
  weekly_views    BIGINT,
  weekly_products BIGINT,
  rank_trend      TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH this_week AS (
    SELECT
      sl.seller_id,
      sl.rank AS weekly_rank,
      sl.score AS weekly_score,
      COALESCE((sl.metric_breakdown->>'likes')::BIGINT, 0)    AS weekly_likes,
      COALESCE((sl.metric_breakdown->>'comments')::BIGINT, 0) AS weekly_comments,
      COALESCE((sl.metric_breakdown->>'views')::BIGINT, 0)    AS weekly_views,
      COALESCE((sl.metric_breakdown->>'activity')::BIGINT, 0) AS weekly_products
    FROM public.seller_leaderboard sl
    WHERE sl.leaderboard_type = 'weekly'
      AND sl.period_start = public.leaderboard_period_start('weekly', NOW())
  ),
  last_week AS (
    SELECT
      sl.seller_id,
      sl.rank AS prev_rank
    FROM public.seller_leaderboard sl
    WHERE sl.leaderboard_type = 'weekly'
      AND sl.period_start = public.leaderboard_period_start('weekly', NOW()) - INTERVAL '1 week'
  )
  SELECT
    p.id            AS seller_id,
    p.full_name,
    p.avatar_url,
    COALESCE(s.name, p.full_name) AS store_name,
    COALESCE(s.is_verified, false)      AS verified,
    t.weekly_rank,
    t.weekly_score,
    t.weekly_likes,
    t.weekly_comments,
    t.weekly_views,
    t.weekly_products,
    CASE
      WHEN lw.prev_rank IS NULL                 THEN 'new'
      WHEN t.weekly_rank < lw.prev_rank          THEN 'rising'
      WHEN t.weekly_rank > lw.prev_rank          THEN 'falling'
      ELSE 'stable'
    END::TEXT AS rank_trend
  FROM this_week t
  JOIN public.profiles p  ON p.id = t.seller_id
  LEFT JOIN public.stores s ON s.seller_id = p.id AND s.is_active = true
  LEFT JOIN last_week lw  ON lw.seller_id = t.seller_id
  ORDER BY t.weekly_rank ASC
  LIMIT p_limit;
$$;

-- ─────────────────────────────────────────────────────────────────
-- Views used by getSellerDailyRank / getSellerWeeklyRank
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.daily_seller_leaderboard AS
SELECT
  sl.seller_id,
  sl.rank  AS daily_rank,
  sl.score AS daily_score,
  sl.period_start,
  sl.period_end,
  sl.metric_breakdown
FROM public.seller_leaderboard sl
WHERE sl.leaderboard_type = 'daily'
  AND sl.period_start = public.leaderboard_period_start('daily', NOW());

CREATE OR REPLACE VIEW public.weekly_seller_leaderboard AS
SELECT
  sl.seller_id,
  sl.rank  AS weekly_rank,
  sl.score AS weekly_score,
  sl.period_start,
  sl.period_end,
  sl.metric_breakdown
FROM public.seller_leaderboard sl
WHERE sl.leaderboard_type = 'weekly'
  AND sl.period_start = public.leaderboard_period_start('weekly', NOW());

-- ─────────────────────────────────────────────────────────────────
-- Convenience wrappers called by refreshDailyLeaderboard /
-- refreshWeeklyLeaderboard in the service
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_daily_leaderboard()
RETURNS TABLE (success BOOLEAN, message TEXT, duration NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_start TIMESTAMPTZ := clock_timestamp();
  v_count INT;
BEGIN
  v_count := public.refresh_seller_leaderboard('daily');
  RETURN QUERY SELECT
    true,
    format('Daily leaderboard refreshed: %s rows', v_count),
    EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_weekly_leaderboard()
RETURNS TABLE (success BOOLEAN, message TEXT, duration NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_start TIMESTAMPTZ := clock_timestamp();
  v_count INT;
BEGIN
  v_count := public.refresh_seller_leaderboard('weekly');
  RETURN QUERY SELECT
    true,
    format('Weekly leaderboard refreshed: %s rows', v_count),
    EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000;
END;
$$;

-- ─────────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_daily_leaderboard_with_rank(INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard_with_rank(INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_daily_leaderboard() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_weekly_leaderboard() TO service_role;

GRANT SELECT ON public.daily_seller_leaderboard TO anon, authenticated;
GRANT SELECT ON public.weekly_seller_leaderboard TO anon, authenticated;
