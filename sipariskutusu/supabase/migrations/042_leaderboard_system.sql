-- Seller leaderboard system for daily, weekly, monthly and yearly discovery.

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

CREATE OR REPLACE FUNCTION public.leaderboard_period_start(p_period TEXT, p_now TIMESTAMPTZ DEFAULT NOW())
RETURNS TIMESTAMPTZ LANGUAGE SQL STABLE AS $$
  SELECT CASE p_period
    WHEN 'daily' THEN date_trunc('day', p_now)
    WHEN 'weekly' THEN date_trunc('week', p_now)
    WHEN 'monthly' THEN date_trunc('month', p_now)
    WHEN 'yearly' THEN date_trunc('year', p_now)
    ELSE date_trunc('week', p_now)
  END;
$$;

CREATE OR REPLACE FUNCTION public.leaderboard_period_end(p_period TEXT, p_start TIMESTAMPTZ)
RETURNS TIMESTAMPTZ LANGUAGE SQL STABLE AS $$
  SELECT CASE p_period
    WHEN 'daily' THEN p_start + INTERVAL '1 day'
    WHEN 'weekly' THEN p_start + INTERVAL '1 week'
    WHEN 'monthly' THEN p_start + INTERVAL '1 month'
    WHEN 'yearly' THEN p_start + INTERVAL '1 year'
    ELSE p_start + INTERVAL '1 week'
  END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_seller_leaderboard(p_period TEXT DEFAULT 'weekly')
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_count INT;
BEGIN
  IF p_period NOT IN ('daily', 'weekly', 'monthly', 'yearly') THEN
    RAISE EXCEPTION 'Invalid leaderboard period: %', p_period;
  END IF;

  v_start := public.leaderboard_period_start(p_period, NOW());
  v_end := public.leaderboard_period_end(p_period, v_start);

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
      COUNT(DISTINCT sl.id) AS likes,
      COUNT(DISTINCT f.id) AS favorites,
      COUNT(DISTINCT sc.id) AS comments,
      COUNT(DISTINCT m.id) AS messages,
      COALESCE(COUNT(DISTINCT lv.id), 0) + COALESCE(SUM(st.view_count), 0) AS views,
      COALESCE(COUNT(DISTINCT sf.id), 0) + COALESCE(MAX(ss.follower_count), 0) AS follows,
      COALESCE(MAX(ss.rating), MAX(p.rating), 0) AS rating,
      COUNT(DISTINCT l.id) AS activity
    FROM public.profiles p
    LEFT JOIN seller_store ss ON ss.seller_id = p.id
    LEFT JOIN public.stories st
      ON COALESCE(st.owner_id, st.user_id) = p.id
      AND st.created_at >= v_start
      AND st.created_at < v_end
      AND COALESCE(st.is_archived, false) = false
    LEFT JOIN public.story_likes sl ON sl.story_id = st.id
    LEFT JOIN public.story_comments sc ON sc.story_id = st.id
    LEFT JOIN public.listings l
      ON l.seller_id = p.id
      AND l.created_at >= v_start
      AND l.created_at < v_end
      AND l.status = 'active'
    LEFT JOIN public.favorites f ON f.listing_id = l.id
    LEFT JOIN public.listing_views lv ON lv.listing_id = l.id
    LEFT JOIN public.store_follows sf
      ON sf.store_id = ss.store_id
      AND sf.created_at >= v_start
      AND sf.created_at < v_end
    LEFT JOIN public.conversations c ON c.seller_id = p.id
    LEFT JOIN public.messages m
      ON m.conversation_id = c.id
      AND m.sender_id <> p.id
      AND m.created_at >= v_start
      AND m.created_at < v_end
    WHERE p.is_seller = true OR ss.store_id IS NOT NULL
    GROUP BY p.id, ss.store_id
  ), scored AS (
    SELECT
      seller_id,
      store_id,
      likes,
      favorites,
      comments,
      messages,
      views,
      follows,
      rating,
      activity,
      (
        likes * 5
        + favorites * 4
        + comments * 3
        + messages * 6
        + views * 0.1
        + follows * 4
        + rating * 10
        + activity * 2
      )::NUMERIC(15,2) AS score
    FROM metrics
  ), ranked AS (
    SELECT
      *,
      ROW_NUMBER() OVER (ORDER BY score DESC, activity DESC, seller_id ASC)::INT AS rank
    FROM scored
  )
  INSERT INTO public.seller_leaderboard (
    seller_id,
    store_id,
    leaderboard_type,
    rank,
    score,
    metric_breakdown,
    period_start,
    period_end
  )
  SELECT
    seller_id,
    store_id,
    p_period,
    rank,
    score,
    jsonb_build_object(
      'likes', likes,
      'favorites', favorites,
      'comments', comments,
      'messages', messages,
      'views', views,
      'follows', follows,
      'rating', rating,
      'activity', activity
    ),
    v_start,
    v_end
  FROM ranked
  WHERE score > 0 OR activity > 0 OR follows > 0;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_all_seller_leaderboards()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_daily INT;
  v_weekly INT;
  v_monthly INT;
  v_yearly INT;
BEGIN
  v_daily := public.refresh_seller_leaderboard('daily');
  v_weekly := public.refresh_seller_leaderboard('weekly');
  v_monthly := public.refresh_seller_leaderboard('monthly');
  v_yearly := public.refresh_seller_leaderboard('yearly');

  RETURN jsonb_build_object(
    'daily', v_daily,
    'weekly', v_weekly,
    'monthly', v_monthly,
    'yearly', v_yearly
  );
END;
$$;

CREATE OR REPLACE VIEW public.seller_leaderboard_current AS
SELECT *
FROM public.seller_leaderboard sl
WHERE sl.period_start = public.leaderboard_period_start(sl.leaderboard_type, NOW());

GRANT EXECUTE ON FUNCTION public.refresh_seller_leaderboard(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_seller_leaderboards() TO service_role;

SELECT public.refresh_all_seller_leaderboards();