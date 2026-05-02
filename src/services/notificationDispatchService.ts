/**
 * notificationDispatchService.ts
 * Favori, beğeni ve takip işlemlerinde satıcıya bildirim gönderir.
 * Spam önleme: aynı (actor, listing/store, type) için 24 saat içinde tekrar gönderilmez.
 */

import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { createInAppNotification } from './inAppNotificationService';

const THROTTLE_DURATION_MS = 24 * 60 * 60 * 1000;

const throttleMap = new Map<string, number>();

function isThrottled(key: string): boolean {
  const last = throttleMap.get(key);
  if (!last) return false;
  return Date.now() - last < THROTTLE_DURATION_MS;
}

function markThrottled(key: string): void {
  throttleMap.set(key, Date.now());
}

async function getListingOwner(listingId: string): Promise<{ sellerId: string; title: string } | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('listings')
      .select('user_id, title')
      .eq('id', listingId)
      .maybeSingle();
    if (error || !data) return null;
    return { sellerId: data.user_id as string, title: data.title as string };
  } catch {
    return null;
  }
}

async function getCurrentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

async function getCurrentUserName(): Promise<string> {
  if (!isSupabaseConfigured) return 'Bir kullanıcı';
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'Bir kullanıcı';
    const meta = user.user_metadata as Record<string, unknown> | null;
    const name = (meta?.full_name ?? meta?.name ?? user.email ?? 'Bir kullanıcı') as string;
    return String(name).split('@')[0] ?? 'Bir kullanıcı';
  } catch {
    return 'Bir kullanıcı';
  }
}

export async function dispatchFavoriteNotification(listingId: string): Promise<void> {
  if (!isSupabaseConfigured || !listingId) return;

  const actorId = await getCurrentUserId();
  if (!actorId) return;

  const key = `fav:${actorId}:${listingId}`;
  if (isThrottled(key)) return;

  const listing = await getListingOwner(listingId);
  if (!listing) return;

  if (listing.sellerId === actorId) return;

  const actorName = await getCurrentUserName();

  try {
    await createInAppNotification(
      listing.sellerId,
      'listing_favorited',
      'Yeni Favori',
      `${actorName} "${listing.title}" ilanını favorilere ekledi.`,
      { listing_id: listingId, actor_id: actorId },
    );
    markThrottled(key);
  } catch {
    // silent — notification failure should not break the favorite action
  }
}

export async function dispatchLikeNotification(listingId: string): Promise<void> {
  if (!isSupabaseConfigured || !listingId) return;

  const actorId = await getCurrentUserId();
  if (!actorId) return;

  const key = `like:${actorId}:${listingId}`;
  if (isThrottled(key)) return;

  const listing = await getListingOwner(listingId);
  if (!listing) return;

  if (listing.sellerId === actorId) return;

  const actorName = await getCurrentUserName();

  try {
    await createInAppNotification(
      listing.sellerId,
      'listing_favorited',
      'Yeni Beğeni',
      `${actorName} "${listing.title}" ilanını beğendi.`,
      { listing_id: listingId, actor_id: actorId },
    );
    markThrottled(key);
  } catch {
    // silent
  }
}

export async function dispatchFollowNotification(storeOwnerId: string, storeName: string): Promise<void> {
  if (!isSupabaseConfigured || !storeOwnerId) return;

  const actorId = await getCurrentUserId();
  if (!actorId) return;

  if (storeOwnerId === actorId) return;

  const key = `follow:${actorId}:${storeOwnerId}`;
  if (isThrottled(key)) return;

  const actorName = await getCurrentUserName();

  try {
    await createInAppNotification(
      storeOwnerId,
      'system',
      'Yeni Takipçi',
      `${actorName}, "${storeName}" mağazanı takip etmeye başladı.`,
      { follower_id: actorId },
    );
    markThrottled(key);
  } catch {
    // silent
  }
}

export async function dispatchPriceDropNotification(
  listingId: string,
  newPrice: number,
  oldPrice: number,
  favoritedByUserIds: string[],
): Promise<void> {
  if (!isSupabaseConfigured || !listingId || favoritedByUserIds.length === 0) return;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('listings')
      .select('title')
      .eq('id', listingId)
      .maybeSingle();
    if (error || !data) return;

    const title = (data as { title: string }).title;
    const discount = Math.round(((oldPrice - newPrice) / oldPrice) * 100);

    await Promise.all(
      favoritedByUserIds.map((uid) =>
        createInAppNotification(
          uid,
          'price_drop',
          'Fiyat Düştü!',
          `Favorindeki "${title}" ürünü %${discount} indirimle şimdi ${newPrice.toFixed(2)} TL.`,
          { listing_id: listingId, new_price: newPrice, old_price: oldPrice },
        ).catch(() => undefined),
      ),
    );
  } catch {
    // silent
  }
}
