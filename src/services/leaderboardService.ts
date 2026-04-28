import { getSupabaseClient } from './supabase';

export interface LeaderboardEntry {
  seller_id: string;
  full_name: string;
  avatar_url: string;
  store_name: string;
  verified: boolean;
  rank: number;
  score: number;
  likes: number;
  comments: number;
  views: number;
  products: number;
  rank_trend: 'rising' | 'falling' | 'stable' | 'new';
}

export interface DailyLeaderboardEntry extends LeaderboardEntry {
  daily_likes: number;
  daily_comments: number;
  daily_views: number;
  daily_products: number;
  daily_score: number;
}

export interface WeeklyLeaderboardEntry extends LeaderboardEntry {
  weekly_likes: number;
  weekly_comments: number;
  weekly_views: number;
  weekly_products: number;
  weekly_score: number;
}

/**
 * Get daily seller leaderboard
 */
export async function getDailyLeaderboard(limit: number = 50): Promise<DailyLeaderboardEntry[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('get_daily_leaderboard_with_rank', {
    p_limit: limit,
  });

  if (error) {
    console.error('Failed to fetch daily leaderboard:', error);
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    seller_id: row.seller_id,
    full_name: row.full_name,
    avatar_url: row.avatar_url,
    store_name: row.store_name,
    verified: row.verified,
    rank: row.daily_rank,
    score: row.daily_score,
    likes: row.daily_likes,
    comments: row.daily_comments,
    views: row.daily_views,
    products: row.daily_products,
    rank_trend: row.rank_trend,
    daily_likes: row.daily_likes,
    daily_comments: row.daily_comments,
    daily_views: row.daily_views,
    daily_products: row.daily_products,
    daily_score: row.daily_score,
  })) as DailyLeaderboardEntry[];
}

/**
 * Get weekly seller leaderboard
 */
export async function getWeeklyLeaderboard(limit: number = 50): Promise<WeeklyLeaderboardEntry[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('get_weekly_leaderboard_with_rank', {
    p_limit: limit,
  });

  if (error) {
    console.error('Failed to fetch weekly leaderboard:', error);
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    seller_id: row.seller_id,
    full_name: row.full_name,
    avatar_url: row.avatar_url,
    store_name: row.store_name,
    verified: row.verified,
    rank: row.weekly_rank,
    score: row.weekly_score,
    likes: row.weekly_likes,
    comments: row.weekly_comments,
    views: row.weekly_views,
    products: row.weekly_products,
    rank_trend: row.rank_trend,
    weekly_likes: row.weekly_likes,
    weekly_comments: row.weekly_comments,
    weekly_views: row.weekly_views,
    weekly_products: row.weekly_products,
    weekly_score: row.weekly_score,
  })) as WeeklyLeaderboardEntry[];
}

/**
 * Get seller's daily rank
 */
export async function getSellerDailyRank(sellerId: string): Promise<number | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('daily_seller_leaderboard')
    .select('daily_rank')
    .eq('seller_id', sellerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    console.error('Failed to get seller daily rank:', error);
    throw error;
  }

  return data?.daily_rank ?? null;
}

/**
 * Get seller's weekly rank
 */
export async function getSellerWeeklyRank(sellerId: string): Promise<number | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('weekly_seller_leaderboard')
    .select('weekly_rank')
    .eq('seller_id', sellerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    console.error('Failed to get seller weekly rank:', error);
    throw error;
  }

  return data?.weekly_rank ?? null;
}

/**
 * Get top daily performers (e.g., for home page hero)
 */
export async function getTopDailyPerformers(limit: number = 5): Promise<DailyLeaderboardEntry[]> {
  return getDailyLeaderboard(limit);
}

/**
 * Get top weekly performers (e.g., for badges/badges on stories)
 */
export async function getTopWeeklyPerformers(limit: number = 5): Promise<WeeklyLeaderboardEntry[]> {
  return getWeeklyLeaderboard(limit);
}

/**
 * Trigger manual refresh of daily leaderboard
 * Should only be called by admin/scheduled job
 */
export async function refreshDailyLeaderboard(): Promise<{
  success: boolean;
  message: string;
  duration_ms: number;
}> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('refresh_daily_leaderboard');

  if (error) {
    console.error('Failed to refresh daily leaderboard:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error('Unexpected response from leaderboard refresh');
  }

  return {
    success: data[0].success,
    message: data[0].message,
    duration_ms: data[0].duration,
  };
}

/**
 * Trigger manual refresh of weekly leaderboard
 * Should only be called by admin/scheduled job
 */
export async function refreshWeeklyLeaderboard(): Promise<{
  success: boolean;
  message: string;
  duration_ms: number;
}> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('refresh_weekly_leaderboard');

  if (error) {
    console.error('Failed to refresh weekly leaderboard:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error('Unexpected response from leaderboard refresh');
  }

  return {
    success: data[0].success,
    message: data[0].message,
    duration_ms: data[0].duration,
  };
}

/**
 * Get leaderboard refresh history
 */
export async function getLeaderboardRefreshHistory(
  limit: number = 20
): Promise<{ leaderboard_type: string; last_refresh: string; duration_ms: number; row_count: number }[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('leaderboard_refresh_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch leaderboard refresh history:', error);
    throw error;
  }

  return (data ?? []) as any[];
}

/**
 * Subscribe to daily leaderboard updates
 */
export function subscribeToDailyLeaderboard(
  onUpdate: (entries: DailyLeaderboardEntry[]) => void,
  onError: (error: any) => void,
  limit: number = 50
) {
  const supabase = getSupabaseClient();

  const subscription = supabase
    .channel('daily_seller_leaderboard_updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_seller_leaderboard' }, () => {
      getDailyLeaderboard(limit)
        .then(onUpdate)
        .catch(onError);
    })
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

/**
 * Subscribe to weekly leaderboard updates
 */
export function subscribeToWeeklyLeaderboard(
  onUpdate: (entries: WeeklyLeaderboardEntry[]) => void,
  onError: (error: any) => void,
  limit: number = 50
) {
  const supabase = getSupabaseClient();

  const subscription = supabase
    .channel('weekly_seller_leaderboard_updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_seller_leaderboard' }, () => {
      getWeeklyLeaderboard(limit)
        .then(onUpdate)
        .catch(onError);
    })
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

/**
 * Get rank badge for display
 */
export function getRankBadge(rank: number | null): { emoji: string; color: string } {
  if (!rank) return { emoji: '', color: '' };
  if (rank === 1) return { emoji: '🥇', color: '#FFD700' };
  if (rank === 2) return { emoji: '🥈', color: '#C0C0C0' };
  if (rank === 3) return { emoji: '🥉', color: '#CD7F32' };
  return { emoji: `#${rank}`, color: '#999' };
}

/**
 * Get trend indicator
 */
export function getTrendIndicator(trend: string): { icon: string; color: string; label: string } {
  const indicators: Record<string, { icon: string; color: string; label: string }> = {
    rising: { icon: '📈', color: '#10B981', label: 'Rising' },
    falling: { icon: '📉', color: '#EF4444', label: 'Falling' },
    stable: { icon: '➡️', color: '#6B7280', label: 'Stable' },
    new: { icon: '⭐', color: '#3B82F6', label: 'New' },
  };
  return indicators[trend] || indicators.stable;
}
