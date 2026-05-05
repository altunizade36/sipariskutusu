-- Applies the seller_leaderboard table, refresh functions, and RPC functions to remote.
-- Fixes: stories.owner_id does not exist on remote → use st.user_id only.
-- Skips the initial data population call to avoid rollback on empty tables.

-- ─────────────────────────────────────────────────────────────────
-- Table
-- ─────────────────────────────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS seller_leaderboard_type_period_rank_idx
  ON public.seller_leaderboard(leaderboard_type, period_start DESC, rank ASC);

ALTER TABLE public.seller_leaderboard ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seller_leaderboard_read_all" ON public.seller_leaderboard;
CREATE POLICY "seller_leaderboard_read_all"
  ON public.seller_leaderboard FOR SELECT
  USING (true);

-- ─────────────────────────────────────────────────────────────────
-- Period helpers
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.leaderboard_period_start(p_period TEXT, p_now TIMESTAMPTZ DEFAULT NOW())
RETURNS TIMESTAMPTZ LANGUAGE SQL STABLE AS $$
  SELECT CASE p_period
    WHEN 'daily'   THEN date_trunc('day',   p_now)
    WHEN 'weekly'  THEN date_trunc('week',  p_now)
    WHEN 'monthly' THEN date_trunc('month', p_now)
    WHEN 'yearly'  THEN date_trunc('year',  p_now)
    ELSE date_trunc('week', p_now)
  END;
$$;

CREATE OR REPLACE FUNCTION public.leaderboard_period_end(p_period TEXT, p_start TIMESTAMPTZ)
RETURNS TIMESTAMPTZ LANGUAGE SQL STABLE AS $$
  SELECT CASE p_period
    WHEN 'daily'   THEN p_start + INTERVAL '1 day'
    WHEN 'weekly'  THEN p_start + INTERVAL '1 week'
    WHEN 'monthly' THEN p_start + INTERVAL '1 month'
    WHEN 'yearly'  THEN p_start + INTERVAL '1 year'
    ELSE p_start + INTERVAL '1 week'
  END;
$$;

-- ─────────────────────────────────────────────────────────────────
-- Refresh function (fixed: uses st.user_id, no owner_id)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_seller_leaderboard(p_period TEXT DEFAULT 'weekly')
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end   TIMESTAMPTZ;
  v_count INT;
BEGIN
  IF p_period NOT IN ('daily', 'weekly', 'monthly', 'yearly') THEN
    RAISE EXCEPTION 'Invalid leaderboard period: %', p_period;
  END IF;

  v_start := public.leaderboard_period_start(p_period, NOW());
  v_end   := public.leaderboard_period_end(p_period, v_start);

  DELETE FROM public.seller_leaderboard
  WHERE leaderboard_type = p_period
    AND period_start = v_start;

  WITH seller_store AS (
    SELECT DISTINCT ON (s.seller_id)
      s.seller_id,
      s.id AS store_id,
      s.follower_count,
      s.rating,
      s.rating_count
    FROM public.stores s
    WHERE s.is_active = true
    ORDER BY s.seller_id, s.is_verified DESC, s.created_at ASC
  ), metrics AS (
    SELECT
      p.id AS seller_id,
      ss.store_id,
      COUNT(DISTINCT sl.id)  AS likes,
      COUNT(DISTINCT f.id)   AS favorites,
      COUNT(DISTINCT sc.id)  AS comments,
      COUNT(DISTINCT m.id)   AS messages,
      COALESCE(COUNT(DISTINCT lv.id), 0) + COALESCE(SUM(st.view_count), 0) AS views,
      COALESCE(COUNT(DISTINCT sf.id), 0) + COALESCE(MAX(ss.follower_count), 0) AS follows,
      COALESCE(MAX(ss.rating), MAX(p.rating), 0) AS rating,
      COUNT(DISTINCT l.id) AS activity
    FROM public.profiles p
    LEFT JOIN seller_store ss ON ss.seller_id = p.id
    LEFT JOIN public.stories st
      ON st.user_id = p.id
      AND st.created_at >= v_start
      AND st.created_at < v_end
      AND COALESCE(st.is_archived, false) = false
    LEFT JOIN public.story_likes sl    ON sl.story_id = st.id
    LEFT JOIN public.story_comments sc ON sc.story_id = st.id
    LEFT JOIN public.listings l
      ON l.seller_id = p.id
      AND l.created_at >= v_start
      AND l.created_at < v_end
      AND l.status = 'active'
    LEFT JOIN public.favorites f       ON f.listing_id = l.id
    LEFT JOIN public.listing_views lv  ON lv.listing_id = l.id
    LEFT JOIN public.store_follows sf
      ON sf.store_id = ss.store_id
      AND sf.created_at >= v_start
      AND sf.created_at < v_end
    LEFT JOIN public.conversations c   ON c.seller_id = p.id
    LEFT JOIN public.messages m
      ON m.conversation_id = c.id
      AND m.sender_id <> p.id
      AND m.created_at >= v_start
      AND m.created_at < v_end
    WHERE p.is_seller = true OR ss.store_id IS NOT NULL
    GROUP BY p.id, ss.store_id
  ), scored AS (
    SELECT
      seller_id, store_id, likes, favorites, comments, messages,
      views, follows, rating, activity,
      (
        likes * 5 + favorites * 4 + comments * 3 + messages * 6
        + views * 0.1 + follows * 4 + rating * 10 + activity * 2
      )::NUMERIC(15,2) AS score
    FROM metrics
  ), ranked AS (
    SELECT *,
      ROW_NUMBER() OVER (ORDER BY score DESC, activity DESC, seller_id ASC)::INT AS rank
    FROM scored
  )
  INSERT INTO public.seller_leaderboard (
    seller_id, store_id, leaderboard_type, rank, score,
    metric_breakdown, period_start, period_end
  )
  SELECT
    seller_id, store_id, p_period, rank, score,
    jsonb_build_object(
      'likes', likes, 'favorites', favorites, 'comments', comments,
      'messages', messages, 'views', views, 'follows', follows,
      'rating', rating, 'activity', activity
    ),
    v_start, v_end
  FROM ranked
  WHERE score > 0 OR activity > 0 OR follows > 0;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_all_seller_leaderboards()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_daily INT; v_weekly INT; v_monthly INT; v_yearly INT;
BEGIN
  v_daily   := public.refresh_seller_leaderboard('daily');
  v_weekly  := public.refresh_seller_leaderboard('weekly');
  v_monthly := public.refresh_seller_leaderboard('monthly');
  v_yearly  := public.refresh_seller_leaderboard('yearly');
  RETURN jsonb_build_object('daily', v_daily, 'weekly', v_weekly,
                             'monthly', v_monthly, 'yearly', v_yearly);
END;
$$;

-- ─────────────────────────────────────────────────────────────────
-- RPC functions called by leaderboardService.ts
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
      sl.rank  AS daily_rank,
      sl.score AS daily_score,
      COALESCE((sl.metric_breakdown->>'likes')::BIGINT,    0) AS daily_likes,
      COALESCE((sl.metric_breakdown->>'comments')::BIGINT, 0) AS daily_comments,
      COALESCE((sl.metric_breakdown->>'views')::BIGINT,    0) AS daily_views,
      COALESCE((sl.metric_breakdown->>'activity')::BIGINT, 0) AS daily_products
    FROM public.seller_leaderboard sl
    WHERE sl.leaderboard_type = 'daily'
      AND sl.period_start = public.leaderboard_period_start('daily', NOW())
  ),
  yesterday AS (
    SELECT sl.seller_id, sl.rank AS prev_rank
    FROM public.seller_leaderboard sl
    WHERE sl.leaderboard_type = 'daily'
      AND sl.period_start = public.leaderboard_period_start('daily', NOW()) - INTERVAL '1 day'
  )
  SELECT
    p.id AS seller_id,
    p.full_name,
    p.avatar_url,
    COALESCE(s.name, p.full_name) AS store_name,
    COALESCE(s.is_verified, false) AS verified,
    t.daily_rank,
    t.daily_score,
    t.daily_likes,
    t.daily_comments,
    t.daily_views,
    t.daily_products,
    CASE
      WHEN y.prev_rank IS NULL           THEN 'new'
      WHEN t.daily_rank < y.prev_rank    THEN 'rising'
      WHEN t.daily_rank > y.prev_rank    THEN 'falling'
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
      sl.rank  AS weekly_rank,
      sl.score AS weekly_score,
      COALESCE((sl.metric_breakdown->>'likes')::BIGINT,    0) AS weekly_likes,
      COALESCE((sl.metric_breakdown->>'comments')::BIGINT, 0) AS weekly_comments,
      COALESCE((sl.metric_breakdown->>'views')::BIGINT,    0) AS weekly_views,
      COALESCE((sl.metric_breakdown->>'activity')::BIGINT, 0) AS weekly_products
    FROM public.seller_leaderboard sl
    WHERE sl.leaderboard_type = 'weekly'
      AND sl.period_start = public.leaderboard_period_start('weekly', NOW())
  ),
  last_week AS (
    SELECT sl.seller_id, sl.rank AS prev_rank
    FROM public.seller_leaderboard sl
    WHERE sl.leaderboard_type = 'weekly'
      AND sl.period_start = public.leaderboard_period_start('weekly', NOW()) - INTERVAL '1 week'
  )
  SELECT
    p.id AS seller_id,
    p.full_name,
    p.avatar_url,
    COALESCE(s.name, p.full_name) AS store_name,
    COALESCE(s.is_verified, false) AS verified,
    t.weekly_rank,
    t.weekly_score,
    t.weekly_likes,
    t.weekly_comments,
    t.weekly_views,
    t.weekly_products,
    CASE
      WHEN lw.prev_rank IS NULL            THEN 'new'
      WHEN t.weekly_rank < lw.prev_rank    THEN 'rising'
      WHEN t.weekly_rank > lw.prev_rank    THEN 'falling'
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
SELECT sl.seller_id, sl.rank AS daily_rank, sl.score AS daily_score,
       sl.period_start, sl.period_end, sl.metric_breakdown
FROM public.seller_leaderboard sl
WHERE sl.leaderboard_type = 'daily'
  AND sl.period_start = public.leaderboard_period_start('daily', NOW());

CREATE OR REPLACE VIEW public.weekly_seller_leaderboard AS
SELECT sl.seller_id, sl.rank AS weekly_rank, sl.score AS weekly_score,
       sl.period_start, sl.period_end, sl.metric_breakdown
FROM public.seller_leaderboard sl
WHERE sl.leaderboard_type = 'weekly'
  AND sl.period_start = public.leaderboard_period_start('weekly', NOW());

-- ─────────────────────────────────────────────────────────────────
-- Convenience wrappers for admin refresh
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_daily_leaderboard()
RETURNS TABLE (success BOOLEAN, message TEXT, duration NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_start TIMESTAMPTZ := clock_timestamp();
  v_count INT;
BEGIN
  v_count := public.refresh_seller_leaderboard('daily');
  RETURN QUERY SELECT true,
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
  RETURN QUERY SELECT true,
    format('Weekly leaderboard refreshed: %s rows', v_count),
    EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000;
END;
$$;

-- ─────────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_daily_leaderboard_with_rank(INT)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard_with_rank(INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_seller_leaderboard(TEXT)      TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_seller_leaderboards()     TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_daily_leaderboard()           TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_weekly_leaderboard()          TO service_role;

GRANT SELECT ON public.daily_seller_leaderboard  TO anon, authenticated;
GRANT SELECT ON public.weekly_seller_leaderboard TO anon, authenticated;
GRANT SELECT ON public.seller_leaderboard        TO anon, authenticated;
