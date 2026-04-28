import { getSupabaseClient } from './supabase';
import {
  getTrendingStories,
  getTopSellersWeekly,
  getSellerEngagementSummary,
  calculateEngagementScore,
  getEngagementTier,
} from './popularityService';

export interface ExploreSellerRanking {
  id: string;
  name: string;
  avatar: string;
  category: string;
  rating: number;
  followers: string;
  coverImage: string;
  headline: string;
  city: string;
  username: string;
  weeklyDrop: string;
  featured: boolean;
  trending: boolean;
  engagementScore: number;
  engagementTier: 'trending' | 'popular' | 'rising' | 'new';
  rank: number;
  trendingIndex?: number;
}

/**
 * Fetch and rank sellers for Explore tab with popularity scoring
 * Combines backend engagement data with store metadata
 */
export async function getExploreSellerRankings(
  storeList: any[],
  limit: number = 24
): Promise<ExploreSellerRanking[]> {
  const supabase = getSupabaseClient();

  try {
    // Fetch top sellers with engagement data
    const topSellers = await getTopSellersWeekly(Math.min(limit + 12, 100));

    // Create engagement map
    const engagementMap = new Map(topSellers.map((seller) => [seller.seller_id, seller]));

    // Rank stores based on engagement + metadata
    const rankedSellers = storeList
      .map((store, idx) => {
        const engagement = engagementMap.get(store.id);
        const score = engagement
          ? calculateEngagementScore(
              engagement.likes || 0,
              engagement.comments || 0,
              engagement.views || 0,
              engagement.products || 0
            )
          : 0;

        const tier = getEngagementTier(score);
        const isTrending = tier === 'trending' || tier === 'popular';

        return {
          ...store,
          engagementScore: score,
          engagementTier: tier,
          rank: engagement?.rank || idx + 1,
          trending: isTrending,
          trendingIndex: isTrending ? topSellers.findIndex((s) => s.seller_id === store.id) : undefined,
        } as ExploreSellerRanking;
      })
      .sort((a, b) => {
        // Trending sellers first
        if (a.trending !== b.trending) return a.trending ? -1 : 1;
        // Then by rank
        if (a.rank !== b.rank) return a.rank - b.rank;
        // Then by engagement score
        return b.engagementScore - a.engagementScore;
      })
      .slice(0, limit);

    return rankedSellers;
  } catch (error) {
    console.error('Failed to get Explore seller rankings:', error);
    // Fall back to original store list with basic metadata
    return storeList.slice(0, limit).map((store, idx) => ({
      ...store,
      engagementScore: 0,
      engagementTier: 'new' as const,
      rank: idx + 1,
      trending: false,
    }));
  }
}

/**
 * Get curated trending stories for Explore tab
 * Shows featured stories with high engagement
 */
export async function getExploreTrendingStories(limit: number = 20) {
  try {
    const stories = await getTrendingStories(limit);
    return stories.filter((story) => {
      // Filter stories with meaningful engagement
      const score = calculateEngagementScore(
        story.like_count,
        story.comment_count,
        story.view_count,
        story.product_count
      );
      return score > 100; // Minimum engagement threshold
    });
  } catch (error) {
    console.error('Failed to get Explore trending stories:', error);
    return [];
  }
}

/**
 * Get algorithmic feed based on seller rankings
 * Combines trending sellers + newly active sellers + user's followed sellers
 */
export async function getAlgorithmicExploreSelection(
  storeList: any[],
  followedSellers: Record<string, boolean>,
  limit: number = 24
) {
  try {
    const rankedSellers = await getExploreSellerRankings(storeList, limit + 10);

    // Segment sellers
    const trendingSellers = rankedSellers.filter((s) => s.trending).slice(0, Math.ceil(limit * 0.4));
    const followedButNotTrending = rankedSellers
      .filter((s) => !s.trending && followedSellers[s.id])
      .slice(0, Math.ceil(limit * 0.2));
    const risingNewSellers = rankedSellers
      .filter((s) => !s.trending && !followedSellers[s.id] && s.engagementTier === 'rising')
      .slice(0, Math.ceil(limit * 0.2));
    const otherSellers = rankedSellers
      .filter(
        (s) => !trendingSellers.includes(s) && !followedButNotTrending.includes(s) && !risingNewSellers.includes(s)
      )
      .slice(0, Math.ceil(limit * 0.2));

    // Shuffle within each segment for variety
    const shuffleSegment = (arr: ExploreSellerRanking[]) => {
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    // Combine and return
    const algorithmicFeed = [
      ...shuffleSegment(trendingSellers),
      ...shuffleSegment(followedButNotTrending),
      ...shuffleSegment(risingNewSellers),
      ...shuffleSegment(otherSellers),
    ].slice(0, limit);

    return algorithmicFeed;
  } catch (error) {
    console.error('Failed to get algorithmic explore selection:', error);
    return storeList.slice(0, limit);
  }
}

/**
 * Log seller impression for analytics
 */
export async function logSellerImpression(
  sellerId: string,
  userId: string,
  context: 'explore_featured' | 'explore_grid' | 'explore_stories' | 'home'
) {
  const supabase = getSupabaseClient();

  try {
    await supabase.from('seller_impressions').insert({
      seller_id: sellerId,
      user_id: userId,
      context,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.debug('Failed to log seller impression:', error);
    // Non-critical, don't throw
  }
}

/**
 * Log seller click for analytics
 */
export async function logSellerClick(
  sellerId: string,
  userId: string,
  context: 'explore_featured' | 'explore_grid' | 'explore_stories' | 'home'
) {
  const supabase = getSupabaseClient();

  try {
    await supabase.from('seller_clicks').insert({
      seller_id: sellerId,
      user_id: userId,
      context,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.debug('Failed to log seller click:', error);
    // Non-critical, don't throw
  }
}

/**
 * Get seller performance metrics for the week
 */
export async function getSellerWeeklyPerformance(sellerId: string) {
  try {
    const summary = await getSellerEngagementSummary(sellerId, 7);
    return {
      totalStories: summary.totalStories,
      totalEngagement: summary.totalLikes + summary.totalComments,
      engagementRate: summary.totalStories > 0 ? (summary.totalLikes + summary.totalComments) / summary.totalStories : 0,
      avgEngagementScore: summary.avgEngagementScore,
      totalViews: summary.totalViews,
      impressionRate: summary.totalStories > 0 ? summary.totalViews / Math.max(summary.totalStories, 1) : 0,
    };
  } catch (error) {
    console.error('Failed to get seller weekly performance:', error);
    return null;
  }
}
