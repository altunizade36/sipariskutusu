/**
 * listingService.ts
 * İlan CRUD, arama, görsel yükleme işlemleri.
 * Tüm işlemler Supabase üzerinden çalışır.
 * Ownership checks ve permission enforcement dahil.
 */

import { getSupabaseClient } from './supabase';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendRequest, isBackendApiConfigured, isBackendStrictMode } from './backendApiClient';
import { invalidateCacheByPrefix } from './noSqlStore';
import { FAVORITES_CACHE_PREFIX, PRODUCTS_CACHE_PREFIX } from '../constants/cacheKeys';
import { checkListingOwnership, validateListingUpdateInput } from './listingPermissionService';

const MEDIA_STORAGE_MODE = (process.env.EXPO_PUBLIC_MEDIA_STORAGE_MODE ?? 'supabase').toLowerCase();
const USE_EXTERNAL_MEDIA_STORAGE = MEDIA_STORAGE_MODE === 'external';
const MAX_LISTING_MEDIA_COUNT = 8;
const IMAGE_UPLOAD_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_IMAGE_UPLOAD_TIMEOUT_MS ?? 20000);
const MAX_IMAGE_BYTES = Number(process.env.EXPO_PUBLIC_MAX_IMAGE_BYTES ?? 3 * 1024 * 1024);
const MAX_VIDEO_BYTES = Number(process.env.EXPO_PUBLIC_MAX_VIDEO_BYTES ?? 50 * 1024 * 1024);
const IMAGE_UPLOAD_CONCURRENCY = Number(process.env.EXPO_PUBLIC_IMAGE_UPLOAD_CONCURRENCY ?? 2);
const MAX_LISTINGS_PAGE_SIZE = 100;
const LISTING_IMAGE_MAX_WIDTH = Number(process.env.EXPO_PUBLIC_LISTING_IMAGE_MAX_WIDTH ?? 1600);
const LISTING_IMAGE_QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58, 0.5, 0.42];
const LISTING_VIEW_DEVICE_ID_KEY = 'listing-view-device-id-v1';
const SUPPORTED_MEDIA_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'm4v']);
const MIN_DESCRIPTION_LENGTH = 20;
const MIN_DESCRIPTION_WORDS = 4;
const PROHIBITED_WORDS = [
  'uyusturucu',
  'narkotik',
  'kacak',
  'calinti',
  'sahte',
  'tabanca',
  'silah',
  'bomba',
  'fisek',
];
const SUSPICIOUS_MEDIA_TERMS = ['nud', 'nude', 'gun', 'weapon', 'drug', '18+', 'adult'];

function isVideoUri(uri: string): boolean {
  const cleanUri = (uri.split('?')[0] ?? uri).toLowerCase();
  return cleanUri.endsWith('.mp4') || cleanUri.endsWith('.mov') || cleanUri.endsWith('.m4v') || cleanUri.endsWith('.webm');
}

export type ListingCondition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';
export type ListingStatus = 'active' | 'sold' | 'paused' | 'deleted';
export type DeliveryType = 'shipping' | 'hand_delivery' | 'both';

export interface Listing {
  id: string;
  seller_id: string;
  owner_id?: string | null;
  store_id?: string | null;
  title: string;
  description?: string | null;
  price: number;
  original_price?: number | null;
  currency: string;
  category_id?: string | null;
  condition: ListingCondition;
  status: ListingStatus;
  delivery: DeliveryType;
  city?: string | null;
  district?: string | null;
  stock: number;
  view_count: number;
  favorite_count: number;
  comment_count?: number | null;
  is_negotiable: boolean;
  like_count?: number | null;
  share_count?: number | null;
  created_at: string;
  updated_at: string;
  listing_images?: Array<{
    id?: string;
    url: string;
    sort_order: number;
    is_cover: boolean;
  }>;
  profiles?: {
    id?: string;
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  } | null;
}

export type SearchFilters = {
  query?: string;
  categoryId?: string;
  category_id?: string;
  minPrice?: number;
  maxPrice?: number;
  city?: string;
  district?: string;
  page?: number;
  pageSize?: number;
  sellerId?: string;
  onlyOwned?: boolean;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'most_liked' | 'most_commented';
};

export type CreateListingInput = {
  title: string;
  description: string;
  price: number;
  categoryId?: string;
  category_id?: string;
  condition: ListingCondition;
  delivery: DeliveryType;
  city?: string;
  district?: string;
  stock?: number;
  isNegotiable?: boolean;
  is_negotiable?: boolean;
  mediaUris?: string[];
  imageUris?: string[];
  videoUri?: string;
  hashtags?: string[];
};

type ListingUpdatePayload = {
  title?: string;
  description?: string;
  price?: number;
  stock?: number;
  condition?: ListingCondition;
  status?: ListingStatus;
  is_negotiable?: boolean;
  imageUris?: string[];
  mediaUris?: string[];
  videoUri?: string | null;
};

async function resolveUserId(userId?: string): Promise<string> {
  if (userId) return userId;
  const { data, error } = await getSupabaseClient().auth.getUser();
  const resolved = data.user?.id;
  if (error || !resolved) {
    throw new Error('Bu işlem için giriş yapmalısın.');
  }
  return resolved;
}

/**
 * updateListing
 * Güncellemede ownership ve permission checks uygula
 */
export async function updateListing(
  listingId: string,
  userIdOrUpdates: string | ListingUpdatePayload,
  updates: ListingUpdatePayload = {}
): Promise<Listing> {
  const supabase = getSupabaseClient();
  const userId = typeof userIdOrUpdates === 'string' ? userIdOrUpdates : await resolveUserId();
  const nextUpdates = typeof userIdOrUpdates === 'string' ? updates : userIdOrUpdates;

  // 1. Ownership check
  const ownership = await checkListingOwnership(listingId, userId);
  if (!ownership.isOwner) {
    throw new Error(ownership.error || 'Bu ilana yetkiniz yok');
  }

  // 2. Input validation
  const validation = validateListingUpdateInput(nextUpdates);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  const { imageUris: _imageUris, mediaUris: _mediaUris, videoUri: _videoUri, ...dbUpdates } = nextUpdates;

  // 3. Update with RLS
  const { data, error } = await supabase
    .from('listings')
    .update({
      ...dbUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)
    .or(`seller_id.eq.${userId},owner_id.eq.${userId}`)
    .select()
    .single();

  if (error) {
    throw new Error(`İlan güncellenemedi: ${error.message}`);
  }

  // Invalidate cache
  invalidateCacheByPrefix(PRODUCTS_CACHE_PREFIX);

  return data as unknown as Listing;
}

/**
 * deleteListing
 * Soft-delete with ownership verification
 */
export async function deleteListing(listingId: string, userId?: string): Promise<void> {
  const supabase = getSupabaseClient();
  const ownerUserId = await resolveUserId(userId);

  // 1. Ownership check
  const ownership = await checkListingOwnership(listingId, ownerUserId);
  if (!ownership.isOwner) {
    throw new Error(ownership.error || 'Bu ilana yetkiniz yok');
  }

  // 2. Soft delete
  const { error } = await supabase
    .from('listings')
    .update({
      status: 'deleted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)
    .or(`seller_id.eq.${ownerUserId},owner_id.eq.${ownerUserId}`);

  if (error) {
    throw new Error(`İlan silinemedi: ${error.message}`);
  }

  // Invalidate cache
  invalidateCacheByPrefix(PRODUCTS_CACHE_PREFIX);
}

/**
 * createListing
 * Create listing with automatic seller_id assignment
 */
export async function createListing(
  userId: string,
  input: CreateListingInput
): Promise<Listing> {
  const supabase = getSupabaseClient();
  const categoryId = input.categoryId ?? input.category_id ?? '';

  // 1. Input validation
  const validation = validateListingUpdateInput({
    title: input.title,
    ...(input.description.trim() ? { description: input.description } : {}),
    price: input.price,
  });
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  // 2. Create with seller_id = auth.uid()
  const { data, error } = await supabase
    .from('listings')
    .insert({
      seller_id: userId,
      title: input.title,
      description: input.description.trim() ? input.description : null,
      price: input.price,
      category_id: categoryId,
      condition: input.condition,
      delivery: input.delivery,
      city: input.city,
      district: input.district,
      stock: input.stock ?? 1,
      is_negotiable: input.isNegotiable ?? false,
      currency: 'TRY',
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`İlan oluşturulamadı: ${error.message}`);
  }

  return data as unknown as Listing;
}

type QuickListingCondition = 'Yeni' | 'Az kullanılmış' | 'İkinci el' | 'Hasarlı';
type QuickListingDelivery = 'Kargo' | 'Elden' | 'Görüşülür';

export type SubmitListingInput = {
  title: string;
  description?: string;
  price: number;
  categoryId: string;
  condition: QuickListingCondition | ListingCondition;
  delivery: QuickListingDelivery[];
  city: string;
  district?: string;
  imageUris: string[];
  coverIndex?: number;
  negotiable?: boolean;
  stock?: number;
};

function mapQuickCondition(condition: SubmitListingInput['condition']): ListingCondition {
  if (condition === 'Yeni' || condition === 'new') return 'new';
  if (condition === 'Az kullanılmış' || condition === 'like_new') return 'like_new';
  if (condition === 'İkinci el' || condition === 'good') return 'good';
  if (condition === 'Hasarlı' || condition === 'poor') return 'poor';
  return 'fair';
}

function mapQuickDelivery(delivery: QuickListingDelivery[]): DeliveryType {
  const hasShipping = delivery.includes('Kargo');
  const hasHandDelivery = delivery.includes('Elden');

  if (hasShipping && hasHandDelivery) return 'both';
  if (hasShipping) return 'shipping';
  if (hasHandDelivery) return 'hand_delivery';
  return 'both';
}

function getMediaExtension(uri: string) {
  const cleanUri = uri.split('?')[0] ?? uri;
  const ext = cleanUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  return SUPPORTED_MEDIA_EXTENSIONS.has(ext) && ext !== 'mp4' && ext !== 'mov' && ext !== 'm4v' ? ext : 'jpg';
}

async function uploadListingImage(userId: string, listingId: string, uri: string, sortOrder: number) {
  const supabase = getSupabaseClient();
  const ext = getMediaExtension(uri);
  const path = `${userId}/${listingId}/${Date.now()}-${sortOrder}.${ext}`;

  const compressedUri = await compressListingImage(uri);
  const response = await fetch(compressedUri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();

  if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Fotoğraf boyutu çok büyük. Daha küçük bir görsel seç.');
  }

  const { error } = await supabase.storage
    .from('listing-images')
    .upload(path, arrayBuffer, {
      contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      upsert: false,
    });

  if (error) {
    throw new Error(`Fotoğraf yüklenemedi: ${error.message}`);
  }

  const { data } = supabase.storage.from('listing-images').getPublicUrl(path);
  return { url: data.publicUrl, path };
}

async function uploadListingImagesWithConcurrency(
  userId: string,
  listingId: string,
  uris: string[],
): Promise<Array<{ listing_id: string; url: string; sort_order: number; is_cover: boolean; path: string }>> {
  const concurrency = Math.max(1, IMAGE_UPLOAD_CONCURRENCY);
  const uploaded: Array<{ listing_id: string; url: string; sort_order: number; is_cover: boolean; path: string }> = [];

  for (let start = 0; start < uris.length; start += concurrency) {
    const chunk = uris.slice(start, start + concurrency);
    const chunkResults = await Promise.all(
      chunk.map(async (uri, chunkIndex) => {
        const sortOrder = start + chunkIndex;
        const uploadedImage = await uploadListingImage(userId, listingId, uri, sortOrder);
        return {
          listing_id: listingId,
          url: uploadedImage.url,
          sort_order: sortOrder,
          is_cover: sortOrder === 0,
          path: uploadedImage.path,
        };
      }),
    );

    uploaded.push(...chunkResults);
  }

  return uploaded;
}

async function compressListingImage(uri: string): Promise<string> {
  const normalizedUri = uri.trim();

  if (!normalizedUri || isVideoUri(normalizedUri)) {
    return normalizedUri;
  }

  const tries = [normalizedUri];

  for (const quality of LISTING_IMAGE_QUALITY_STEPS) {
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        tries[tries.length - 1],
        [{ resize: { width: LISTING_IMAGE_MAX_WIDTH } }],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.WEBP,
        },
      );

      tries.push(manipulated.uri);

      const probe = await fetch(manipulated.uri);
      const probeBuffer = await (await probe.blob()).arrayBuffer();
      if (probeBuffer.byteLength <= MAX_IMAGE_BYTES) {
        return manipulated.uri;
      }
    } catch {
      return normalizedUri;
    }
  }

  return tries[tries.length - 1] ?? normalizedUri;
}

export async function submitListingToSupabase(input: SubmitListingInput): Promise<Listing> {
  const supabase = getSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const userId = authData.user?.id;

  if (authError || !userId) {
    throw new Error('İlan yayınlamak için giriş yapmalısın.');
  }

  const imageUris = input.imageUris.filter(Boolean).slice(0, 5);
  if (imageUris.length === 0) {
    throw new Error('En az 1 fotoğraf eklemelisin.');
  }

  if (!input.title.trim()) {
    throw new Error('Başlık zorunlu.');
  }

  if (!input.categoryId) {
    throw new Error('Kategori zorunlu.');
  }

  if (!Number.isFinite(input.price) || input.price <= 0) {
    throw new Error('Geçerli bir fiyat girmelisin.');
  }

  if (!input.city.trim()) {
    throw new Error('Şehir zorunlu.');
  }

  const coverIndex = Math.min(Math.max(input.coverIndex ?? 0, 0), imageUris.length - 1);
  const orderedUris = coverIndex > 0
    ? [imageUris[coverIndex], ...imageUris.filter((_, index) => index !== coverIndex)]
    : imageUris;

  const listing = await createListing(userId, {
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    price: input.price,
    categoryId: input.categoryId,
    condition: mapQuickCondition(input.condition),
    delivery: mapQuickDelivery(input.delivery),
    city: input.city.trim(),
    district: input.district?.trim() ?? '',
    stock: input.stock ?? 1,
    isNegotiable: Boolean(input.negotiable),
  });

  const uploadedPaths: string[] = [];

  try {
    const uploadedImages = await uploadListingImagesWithConcurrency(userId, listing.id, orderedUris);
    uploadedPaths.push(...uploadedImages.map((item) => item.path));

    const { error: imageError } = await supabase.from('listing_images').insert(
      uploadedImages.map(({ path: _path, ...row }) => row),
    );
    if (imageError) {
      throw new Error(`İlan görselleri kaydedilemedi: ${imageError.message}`);
    }
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from('listing-images').remove(uploadedPaths).catch(() => undefined);
    }
    await supabase.from('listings').delete().eq('id', listing.id).or(`seller_id.eq.${userId},owner_id.eq.${userId}`);
    throw error;
  }

  invalidateCacheByPrefix(PRODUCTS_CACHE_PREFIX);
  return listing;
}

export async function fetchListing(listingId: string): Promise<Listing> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('listings')
    .select(
      `
      *,
      listing_images(id, url, sort_order, is_cover),
      profiles!listings_seller_id_fkey(id, full_name, username, avatar_url)
      `,
    )
    .eq('id', listingId)
    .single();

  if (error || !data) {
    throw new Error(`İlan yüklenemedi: ${error?.message ?? 'İlan bulunamadı'}`);
  }

  return data as unknown as Listing;
}

export async function incrementListingShareCount(listingId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('increment_share_count', { listing_id: listingId });

  if (error) {
    throw new Error(`Paylaşım sayacı güncellenemedi: ${error.message}`);
  }
}

export function subscribeToListingChanges(listingId: string, onChange: () => void): () => void {
  if (!listingId?.trim()) {
    return () => undefined;
  }

  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`listing-${listingId}-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'listings',
        filter: `id=eq.${listingId}`,
      },
      () => {
        onChange();
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/**
 * fetchListings
 * Get listings with optional ownership filter
 */
export async function fetchListings(
  filters?: SearchFilters,
  userIdOrPage?: string | number,
  pageSizeArg?: number,
): Promise<Listing[]> {
  const supabase = getSupabaseClient();
  const userId = typeof userIdOrPage === 'string' ? userIdOrPage : undefined;

  let query = supabase
    .from('listings')
    .select(
      `
      id,
      seller_id,
      owner_id,
      store_id,
      title,
      description,
      price,
      original_price,
      currency,
      category_id,
      condition,
      status,
      delivery,
      city,
      district,
      stock,
      view_count,
      favorite_count,
      comment_count,
      is_negotiable,
      like_count,
      share_count,
      created_at,
      updated_at,
      profiles!listings_seller_id_fkey(id, full_name, username, avatar_url)
      `,
    )
    .eq('status', 'active');

  // If onlyOwned, filter by current user
  if (filters?.onlyOwned && userId) {
    query = query.eq('seller_id', userId);
  } else if (filters?.sellerId) {
    query = query.eq('seller_id', filters.sellerId);
  }

  const categoryFilter = filters?.categoryId ?? filters?.category_id;
  if (categoryFilter) {
    query = query.eq('category_id', categoryFilter);
  }

  if (filters?.minPrice) {
    query = query.gte('price', filters.minPrice);
  }

  if (filters?.maxPrice) {
    query = query.lte('price', filters.maxPrice);
  }

  if (filters?.city) {
    query = query.eq('city', filters.city);
  }

  if (filters?.query) {
    query = query.or(`title.ilike.%${filters.query}%,description.ilike.%${filters.query}%`);
  }

  if (filters?.district) {
    query = query.eq('district', filters.district);
  }

  const page = typeof userIdOrPage === 'number' ? userIdOrPage : (filters?.page ?? 0);
  const pageSize = Math.min(pageSizeArg ?? filters?.pageSize ?? 20, MAX_LISTINGS_PAGE_SIZE);
  const offset = page * pageSize;

  // Sort
  switch (filters?.sort) {
    case 'price_asc':
      query = query.range(offset, offset + pageSize - 1).order('price', { ascending: true });
      break;
    case 'price_desc':
      query = query.range(offset, offset + pageSize - 1).order('price', { ascending: false });
      break;
    case 'most_liked':
      query = query.range(offset, offset + pageSize - 1).order('like_count', { ascending: false });
      break;
    case 'most_commented':
      query = query.range(offset, offset + pageSize - 1).order('comment_count', { ascending: false });
      break;
    default:
      query = query.range(offset, offset + pageSize - 1).order('created_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching listings:', error);
    return [];
  }

  const listings = ((data || []) as unknown as Listing[]);
  if (listings.length === 0) {
    return listings;
  }

  const listingIds = listings.map((item) => item.id);
  const { data: coverRows, error: coverError } = await supabase
    .from('listing_images')
    .select('listing_id, url, sort_order, is_cover')
    .in('listing_id', listingIds)
    .eq('is_cover', true);

  if (coverError) {
    return listings;
  }

  const coverMap = new Map<string, { url: string; sort_order: number; is_cover: boolean }>();
  for (const row of (coverRows ?? []) as Array<{ listing_id: string; url: string; sort_order: number; is_cover: boolean }>) {
    if (!coverMap.has(row.listing_id)) {
      coverMap.set(row.listing_id, {
        url: row.url,
        sort_order: row.sort_order,
        is_cover: row.is_cover,
      });
    }
  }

  return listings.map((listing) => {
    const cover = coverMap.get(listing.id);
    return {
      ...listing,
      listing_images: cover ? [{
        url: cover.url,
        sort_order: cover.sort_order,
        is_cover: cover.is_cover,
      }] : [],
    };
  });
}

/**
 * getListing
 * Get single listing with ownership check if needed
 */
export async function getListing(listingId: string, userId?: string): Promise<Listing | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('listings')
    .select()
    .eq('id', listingId)
    .single();

  if (error || !data) {
    return null;
  }

  const listing = data as unknown as Listing;

  // If userId provided and status is not active, verify ownership
  if (userId && listing.status !== 'active') {
    if (listing.seller_id !== userId) {
      return null; // User can't view inactive listings they don't own
    }
  }

  return listing;
}

/**
 * transferListingImages
 * Upload images with ownership verification
 */
export async function transferListingImages(
  listingId: string,
  userId: string,
  imageUris: string[]
): Promise<string[]> {
  // 1. Ownership check
  const ownership = await checkListingOwnership(listingId, userId);
  if (!ownership.isOwner) {
    throw new Error(ownership.error || 'Bu ilana yetkiniz yok');
  }

  const supabase = getSupabaseClient();
  const uploadedUrls: string[] = [];

  for (const uri of imageUris) {
    try {
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${userId}/${listingId}/${Date.now()}.${ext}`;

      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('listing-images')
        .upload(path, arrayBuffer, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        });

      if (uploadError) {
        console.error('Image upload error:', uploadError);
        continue;
      }

      const { data: publicUrl } = supabase.storage
        .from('listing-images')
        .getPublicUrl(path);

      uploadedUrls.push(publicUrl.publicUrl);
    } catch (err) {
      console.error('Error uploading image:', err);
    }
  }

  return uploadedUrls;
}
