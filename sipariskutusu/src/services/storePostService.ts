import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import type { StorePost } from '../data/storeData';

export type StorePostRow = {
  id: string;
  store_id: string;
  seller_id: string;
  source_type: 'manual' | 'instagram';
  source_id: string | null;
  image_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  title: string;
  post_type: 'product' | 'campaign' | 'collection';
  media_type: 'image' | 'video' | 'carousel';
  like_count: number;
  comment_count: number;
  linked_listing_id: string | null;
  original_timestamp: string | null;
  created_at: string;
};

export type InstagramStorePostImport = {
  id: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  caption: string;
  timestamp: string;
  likeCount?: number;
  commentsCount?: number;
  mediaType?: string;
  isVideo?: boolean;
};

function inferMediaType(input: InstagramStorePostImport): StorePostRow['media_type'] {
  if (input.isVideo || input.mediaType === 'VIDEO') return 'video';
  if (input.mediaType === 'CAROUSEL_ALBUM') return 'carousel';
  return 'image';
}

function titleFromCaption(caption: string) {
  const title = caption
    .split(/\s+/)
    .filter((word) => word && !word.startsWith('#') && !word.startsWith('@'))
    .slice(0, 7)
    .join(' ')
    .trim();
  return title || 'Instagram paylaşımı';
}

function mapRow(row: StorePostRow): StorePost {
  return {
    id: row.source_type === 'instagram' && row.source_id ? `instagram-${row.source_id}` : row.id,
    image: row.thumbnail_url || row.image_url,
    title: row.title,
    date: row.original_timestamp || row.created_at,
    type: row.post_type,
    likes: row.like_count,
    comments: row.comment_count,
    isVideo: row.media_type === 'video',
    linkedProductId: row.linked_listing_id ?? undefined,
    source: row.source_type,
    sourceId: row.source_id ?? undefined,
    caption: row.caption ?? undefined,
  };
}

async function getCurrentUserAndStore() {
  const supabase = getSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) {
    throw new Error('Mağaza paylaşımı için giriş yapmalısın.');
  }

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id,seller_id')
    .eq('seller_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (storeError) throw storeError;
  if (!store) {
    throw new Error('Instagram paylaşımı için önce mağaza oluşturmalısın.');
  }

  return { user, store };
}

export async function fetchStorePosts(storeId: string): Promise<StorePost[]> {
  if (!isSupabaseConfigured || !storeId) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('store_posts')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) throw error;
  return ((data ?? []) as StorePostRow[]).map(mapRow);
}

export async function importInstagramStorePosts(items: InstagramStorePostImport[]): Promise<StorePost[]> {
  if (!isSupabaseConfigured || items.length === 0) return [];

  const supabase = getSupabaseClient();
  const { user, store } = await getCurrentUserAndStore();
  const payload = items.map((item) => ({
    store_id: store.id,
    seller_id: user.id,
    source_type: 'instagram',
    source_id: item.id,
    image_url: item.mediaUrl,
    thumbnail_url: item.thumbnailUrl || null,
    caption: item.caption || null,
    title: titleFromCaption(item.caption),
    post_type: 'product',
    media_type: inferMediaType(item),
    like_count: 0,
    comment_count: 0,
    original_timestamp: item.timestamp || null,
  }));

  const { data, error } = await supabase
    .from('store_posts')
    .upsert(payload, { onConflict: 'store_id,source_type,source_id' })
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as StorePostRow[]).map(mapRow);
}

export async function linkInstagramStorePostToListing(sourceId: string, listingId: string): Promise<void> {
  if (!isSupabaseConfigured || !sourceId || !listingId) return;

  const supabase = getSupabaseClient();
  const { store } = await getCurrentUserAndStore();
  const { error } = await supabase
    .from('store_posts')
    .update({ linked_listing_id: listingId })
    .eq('store_id', store.id)
    .eq('source_type', 'instagram')
    .eq('source_id', sourceId);

  if (error) throw error;
}
