import { getSupabaseClient } from './supabase';

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all';

export interface ExploreFeaturedStory {
  id: string;
  storyId: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  imageUrl: string;
  caption?: string;
  productId?: string;
  productTitle?: string;
  priceTag?: string;
  featuredType: 'daily' | 'weekly' | 'trending';
  popularityScore: number;
  badge: string;
  isLive: boolean;
}

export interface SellerPeriodLeaderboardEntry {
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  storeName: string;
  rank: number;
  score: number;
  likes: number;
  favorites: number;
  comments: number;
  messages: number;
  sales: number;
  views: number;
  follows: number;
  rating: number;
  activity: number;
}

function periodStartIso(period: LeaderboardPeriod): string {
  const now = new Date();

  if (period === 'daily') {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }

  if (period === 'weekly') {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    now.setDate(now.getDate() - diff);
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }

  if (period === 'monthly') {
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }

  if (period === 'all') {
    return new Date('2000-01-01').toISOString();
  }

  now.setMonth(0, 1);
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function badgeFromFeaturedType(featuredType: string): string {
  if (featuredType === 'trending') return 'Trend';
  if (featuredType === 'weekly') return 'Yeni';
  return 'Populer';
}

export async function fetchExploreFeaturedStories(limit: number = 20): Promise<ExploreFeaturedStory[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('explore_featured_stories')
    .select(`
      id,
      story_id,
      seller_id,
      featured_type,
      popularity_score,
      stories(
        id,
        image_url,
        caption,
        listing_id,
        created_at,
        profiles!stories_user_id_fkey(full_name, avatar_url),
        listings(title, price)
      )
    `)
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('popularity_score', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row: any) => {
      const storyRow = row.stories;
      if (!storyRow?.id || !storyRow?.image_url) {
        return null;
      }

      const createdAt = new Date(storyRow.created_at ?? 0).getTime();
      const isLive = Number.isFinite(createdAt) && Date.now() - createdAt < 2 * 60 * 60 * 1000;

      return {
        id: row.id,
        storyId: storyRow.id,
        sellerId: row.seller_id,
        sellerName: storyRow.profiles?.full_name?.trim() || 'Satici',
        sellerAvatar:
          storyRow.profiles?.avatar_url ||
          storyRow.image_url,
        imageUrl: storyRow.image_url,
        caption: storyRow.caption ?? undefined,
        productId: storyRow.listing_id ?? undefined,
        productTitle: storyRow.listings?.title ?? undefined,
        priceTag: storyRow.listings?.price ? `${storyRow.listings.price} TL` : undefined,
        featuredType: (row.featured_type ?? 'daily') as 'daily' | 'weekly' | 'trending',
        popularityScore: asNumber(row.popularity_score),
        badge: badgeFromFeaturedType(row.featured_type ?? 'daily'),
        isLive,
      } as ExploreFeaturedStory;
    })
    .filter(Boolean) as ExploreFeaturedStory[];
}

export async function fetchSellerPeriodLeaderboard(
  period: LeaderboardPeriod,
  limit: number = 50,
): Promise<SellerPeriodLeaderboardEntry[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('seller_leaderboard')
    .select(`
      seller_id,
      rank,
      score,
      metric_breakdown,
      period_start,
      profiles(full_name, avatar_url),
      stores(name)
    `)
    .order('rank', { ascending: true })
    .limit(limit);

  if (period === 'all') {
    query = query.order('score', { ascending: false });
  } else {
    query = query
      .eq('leaderboard_type', period)
      .gte('period_start', periodStartIso(period));
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((row: any) => {
    const metrics = row.metric_breakdown ?? {};
    const likes = asNumber(metrics.likes);
    const comments = asNumber(metrics.comments);
    const views = asNumber(metrics.views);
    const favorites = asNumber(metrics.favorites);
    const messages = asNumber(metrics.messages);
    const sales = asNumber(metrics.sales || metrics.orders || metrics.sold || metrics.completed_orders);
    const follows = asNumber(metrics.follows);
    const rating = asNumber(metrics.rating);
    const activity = asNumber(metrics.activity || metrics.products);

    return {
      sellerId: row.seller_id,
      sellerName: row.profiles?.full_name?.trim() || 'Satici',
      sellerAvatar: row.profiles?.avatar_url || '',
      storeName: row.stores?.name || row.profiles?.full_name || 'Magaza',
      rank: asNumber(row.rank),
      score: asNumber(row.score),
      likes,
      favorites,
      comments,
      messages,
      sales,
      views,
      follows,
      rating,
      activity,
    };
  });
}

export function buildCompetitionLists(entries: SellerPeriodLeaderboardEntry[]) {
  const rising = [...entries].sort((a, b) => b.score - a.score).slice(0, 8);
  const live = [...entries].sort((a, b) => (b.views + b.activity) - (a.views + a.activity)).slice(0, 8);
  const liked = [...entries].sort((a, b) => b.likes - a.likes).slice(0, 8);
  const commented = [...entries].sort((a, b) => b.comments - a.comments).slice(0, 8);
  const sales = [...entries].sort((a, b) => b.sales - a.sales).slice(0, 8);
  const messaged = [...entries].sort((a, b) => b.messages - a.messages).slice(0, 8);
  const active = [...entries].sort((a, b) => b.activity - a.activity).slice(0, 8);

  return { rising, live, liked, commented, sales, messaged, active };
}
