import { getSupabaseClient } from './supabase';

export interface PopularityScore {
  storyId: string;
  sellerId: string;
  engagementScore: number;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  productCount: number;
  timestamp: string;
}

export interface TrendingStory {
  id: string;
  seller_id: string;
  seller_name: string;
  seller_avatar: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  like_count: number;
  comment_count: number;
  view_count: number;
  product_count: number;
  engagement_score: number;
}

export interface SellerRanking {
  seller_id: string;
  rank: number;
  score: number;
  likes: number;
  comments: number;
  views: number;
  products: number;
}

export interface TopSeller {
  seller_id: string;
  full_name: string;
  avatar_url: string;
  store_name: string;
  store_avatar: string;
  rank: number;
  score: number;
  likes: number;
  comments: number;
  views: number;
  products: number;
  active_stories: number;
}

/**
 * Get trending stories for Explore tab
 * Sorted by engagement score (likes*5 + comments*3 + views*0.1 + products*2)
 */
export async function getTrendingStories(limit: number = 20): Promise<TrendingStory[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('top_stories_trending')
    .select('*')
    .limit(limit);

  if (error) {
    console.error('Failed to fetch trending stories:', error);
    throw error;
  }

  return (data ?? []) as TrendingStory[];
}

/**
 * Get trending stories by category or seller type
 */
export async function getTrendingStoriesBySeller(sellerId: string, limit: number = 10): Promise<TrendingStory[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('top_stories_trending')
    .select('*')
    .eq('seller_id', sellerId)
    .limit(limit);

  if (error) {
    console.error('Failed to fetch seller trending stories:', error);
    throw error;
  }

  return (data ?? []) as TrendingStory[];
}

/**
 * Get top sellers for this week
 */
export async function getTopSellersWeekly(limit: number = 20): Promise<TopSeller[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('top_sellers_weekly')
    .select('*')
    .limit(limit);

  if (error) {
    console.error('Failed to fetch top sellers:', error);
    throw error;
  }

  return (data ?? []) as TopSeller[];
}

/**
 * Get seller's engagement summary for a period
 */
export async function getSellerEngagementSummary(
  sellerId: string,
  days: number = 7
): Promise<{
  totalStories: number;
  totalLikes: number;
  totalComments: number;
  totalViews: number;
  avgEngagementScore: number;
  mostPopularStoryId: string | null;
  mostPopularStoryScore: number | null;
}> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('get_seller_engagement_summary', {
    p_seller_id: sellerId,
    p_days: days,
  });

  if (error) {
    console.error('Failed to get seller engagement summary:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return {
      totalStories: 0,
      totalLikes: 0,
      totalComments: 0,
      totalViews: 0,
      avgEngagementScore: 0,
      mostPopularStoryId: null,
      mostPopularStoryScore: null,
    };
  }

  const row = data[0];
  return {
    totalStories: row.total_stories || 0,
    totalLikes: row.total_likes || 0,
    totalComments: row.total_comments || 0,
    totalViews: row.total_views || 0,
    avgEngagementScore: parseFloat(row.avg_engagement_score || 0),
    mostPopularStoryId: row.most_popular_story_id,
    mostPopularStoryScore: row.most_popular_story_score ? parseFloat(row.most_popular_story_score) : null,
  };
}

/**
 * Get engagement stats for a specific story
 */
export async function getStoryEngagement(storyId: string): Promise<{
  likeCount: number;
  commentCount: number;
  viewCount: number;
  productLinkCount: number;
  engagementScore: number;
}> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('get_story_engagement', {
    p_story_id: storyId,
  });

  if (error) {
    console.error('Failed to get story engagement:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return {
      likeCount: 0,
      commentCount: 0,
      viewCount: 0,
      productLinkCount: 0,
      engagementScore: 0,
    };
  }

  const row = data[0];
  return {
    likeCount: row.like_count || 0,
    commentCount: row.comment_count || 0,
    viewCount: row.view_count || 0,
    productLinkCount: row.product_link_count || 0,
    engagementScore: parseFloat(row.engagement_score || 0),
  };
}

/**
 * Calculate daily leaderboard (admin function)
 * Should be called via scheduled job
 */
export async function calculateDailyLeaderboard(): Promise<SellerRanking[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('calculate_daily_leaderboard');

  if (error) {
    console.error('Failed to calculate daily leaderboard:', error);
    throw error;
  }

  return (data ?? []) as SellerRanking[];
}

/**
 * Calculate weekly leaderboard (admin function)
 * Should be called via scheduled job
 */
export async function calculateWeeklyLeaderboard(): Promise<SellerRanking[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('calculate_weekly_leaderboard');

  if (error) {
    console.error('Failed to calculate weekly leaderboard:', error);
    throw error;
  }

  return (data ?? []) as SellerRanking[];
}

/**
 * Get daily leaderboard for specific date
 */
export async function getDailyLeaderboard(limit: number = 50): Promise<SellerRanking[]> {
  const supabase = getSupabaseClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('seller_leaderboard')
    .select('seller_id, rank, score, metric_breakdown')
    .eq('leaderboard_type', 'daily')
    .gte('period_start', today.toISOString())
    .order('rank', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch daily leaderboard:', error);
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    seller_id: row.seller_id,
    rank: row.rank,
    score: row.score,
    likes: row.metric_breakdown?.likes || 0,
    comments: row.metric_breakdown?.comments || 0,
    views: row.metric_breakdown?.views || 0,
    products: row.metric_breakdown?.products || 0,
  }));
}

/**
 * Get weekly leaderboard
 */
export async function getWeeklyLeaderboard(limit: number = 50): Promise<SellerRanking[]> {
  const supabase = getSupabaseClient();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('seller_leaderboard')
    .select('seller_id, rank, score, metric_breakdown')
    .eq('leaderboard_type', 'weekly')
    .gte('period_start', weekStart.toISOString())
    .order('rank', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch weekly leaderboard:', error);
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    seller_id: row.seller_id,
    rank: row.rank,
    score: row.score,
    likes: row.metric_breakdown?.likes || 0,
    comments: row.metric_breakdown?.comments || 0,
    views: row.metric_breakdown?.views || 0,
    products: row.metric_breakdown?.products || 0,
  }));
}

/**
 * Calculate engagement score (formula: likes*5 + comments*3 + views*0.1 + products*2)
 */
export function calculateEngagementScore(
  likes: number,
  comments: number,
  views: number,
  products: number
): number {
  return likes * 5 + comments * 3 + views * 0.1 + products * 2;
}

/**
 * Format engagement score for display
 */
export function formatEngagementScore(score: number): string {
  if (score >= 1000000) {
    return `${(score / 1000000).toFixed(1)}M`;
  }
  if (score >= 1000) {
    return `${(score / 1000).toFixed(1)}K`;
  }
  return Math.round(score).toString();
}

/**
 * Get engagement tier/badge based on score
 */
export function getEngagementTier(score: number): 'trending' | 'popular' | 'rising' | 'new' {
  if (score >= 50000) return 'trending';
  if (score >= 10000) return 'popular';
  if (score >= 1000) return 'rising';
  return 'new';
}

/**
 * Get engagement tier color for UI display
 */
export function getEngagementTierColor(tier: string): string {
  const colors: Record<string, string> = {
    trending: '#FF4757', // Red/hot
    popular: '#FF9800', // Orange
    rising: '#4CAF50', // Green
    new: '#2196F3', // Blue
  };
  return colors[tier] || '#999';
}

/**
 * Subscribe to trending stories updates
 */
export function subscribeToTrendingStories(
  onUpdate: (stories: TrendingStory[]) => void,
  onError: (error: any) => void,
  limit: number = 20
) {
  const supabase = getSupabaseClient();

  const subscription = supabase
    .channel('top_stories_trending_updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'top_stories_trending' }, () => {
      getTrendingStories(limit)
        .then(onUpdate)
        .catch(onError);
    })
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

/**
 * Subscribe to leaderboard updates
 */
export function subscribeToLeaderboardUpdates(
  onUpdate: (sellers: TopSeller[]) => void,
  onError: (error: any) => void,
  limit: number = 20
) {
  const supabase = getSupabaseClient();

  const subscription = supabase
    .channel('top_sellers_weekly_updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'top_sellers_weekly' }, () => {
      getTopSellersWeekly(limit)
        .then(onUpdate)
        .catch(onError);
    })
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}
