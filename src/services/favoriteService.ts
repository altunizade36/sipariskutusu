/**
 * favoriteService.ts
 * Favori ekleme/çıkarma, favori listesi.
 */

import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import type { Listing } from './listingService';
import { invalidateCacheByPrefix } from './noSqlStore';
import { FAVORITES_CACHE_PREFIX, PRODUCTS_CACHE_PREFIX } from '../constants/cacheKeys';

async function refreshFavoriteCounter(listingId: string) {
  const supabase = getSupabaseClient();
  const { count, error: countError } = await supabase
    .from('favorites')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', listingId);

  if (countError || count === null) {
    return;
  }

  await supabase
    .from('listings')
    .update({ favorite_count: count, like_count: count })
    .eq('id', listingId)
    .then(() => undefined);
}

async function applyFavoriteCounter(listingId: string) {
  await refreshFavoriteCounter(listingId);
}

export async function fetchFavorites(): Promise<Listing[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('favorites')
    .select('listing_id, listings(*, listing_images(url, storage_path, sort_order, is_cover))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? [])
    .map((f: Record<string, unknown>) => f.listings)
    .filter((l): l is Listing => !!l) as Listing[];
}

export async function toggleFavorite(listingId: string): Promise<boolean> {
  if (!listingId?.trim()) {
    throw new Error('Gecersiz ilan kimligi.');
  }

  const supabase = getSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Giriş yapmanız gerekiyor.');

  const { data: existing, error: existingError } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('listing_id', listingId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    const { error: deleteError } = await supabase.from('favorites').delete().eq('id', existing.id);
    if (deleteError) {
      throw deleteError;
    }

    await applyFavoriteCounter(listingId);

    await Promise.all([
      invalidateCacheByPrefix(FAVORITES_CACHE_PREFIX),
      invalidateCacheByPrefix(PRODUCTS_CACHE_PREFIX),
    ]).catch(() => undefined);
    return false;
  } else {
    const { error: insertError } = await supabase.from('favorites').insert({ user_id: user.id, listing_id: listingId });
    if (insertError) {
      throw insertError;
    }

    await applyFavoriteCounter(listingId);

    await Promise.all([
      invalidateCacheByPrefix(FAVORITES_CACHE_PREFIX),
      invalidateCacheByPrefix(PRODUCTS_CACHE_PREFIX),
    ]).catch(() => undefined);

    // Satıcıya bildirim gönder (fire-and-forget, spam-korumalı)
    import('../services/notificationDispatchService')
      .then(({ dispatchFavoriteNotification }) => dispatchFavoriteNotification(listingId))
      .catch(() => undefined);

    return true;
  }
}

export async function isFavorited(listingId: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    return false;
  }

  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('listing_id', listingId)
    .maybeSingle();

  return !!data;
}

export function subscribeToListingFavoriteState(
  userId: string,
  listingId: string,
  onChange: () => void,
): () => void {
  if (!isSupabaseConfigured || !userId || !listingId) {
    return () => undefined;
  }

  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`favorite-${userId}-${listingId}-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'favorites',
        filter: `listing_id=eq.${listingId}`,
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as { user_id?: string } | null;
        if (!row?.user_id || row.user_id === userId) {
          onChange();
        }
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

// SQL: like count RPC'leri (Supabase'e ekleyin)
// CREATE OR REPLACE FUNCTION increment_like_count(listing_id UUID) RETURNS VOID LANGUAGE SQL AS $$
//   UPDATE listings
//   SET like_count = like_count + 1,
//       favorite_count = favorite_count + 1
//   WHERE id = listing_id;
// $$;
// CREATE OR REPLACE FUNCTION decrement_like_count(listing_id UUID) RETURNS VOID LANGUAGE SQL AS $$
//   UPDATE listings
//   SET like_count = GREATEST(like_count - 1, 0),
//       favorite_count = GREATEST(favorite_count - 1, 0)
//   WHERE id = listing_id;
// $$;
