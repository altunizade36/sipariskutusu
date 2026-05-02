/**
 * listingMapper.ts
 * Supabase Listing -> UI Product dönüşüm yardımcıları.
 * Context ve hook'lar tarafından paylaşılır.
 */

import { getCategorySlugPath } from '../catalog';
import type { Listing } from '../services/listingService';
import type { Product } from '../data/mockData';

const listingImagesByCategory: Record<string, string> = {
  women: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80',
  men: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
  'mother-child': 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=600&q=80',
  home: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&q=80',
  supermarket: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80',
  cosmetics: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&q=80',
  'shoes-bags': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
  electronics: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80',
  watches: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=80',
  sports: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=600&q=80',
};

const catalogRootToLegacyCategory: Record<string, Product['category']> = {
  kadin: 'women',
  erkek: 'men',
  'anne-cocuk': 'mother-child',
  'ev-yasam': 'home',
  supermarket: 'supermarket',
  kozmetik: 'cosmetics',
  'ayakkabi-canta': 'shoes-bags',
  elektronik: 'electronics',
  'saat-aksesuar': 'watches',
  'spor-outdoor': 'sports',
  otomotiv: 'electronics',
  'kitap-hobi-kirtasiye': 'home',
  'pet-shop': 'home',
  'yapi-market-bahce': 'home',
  'ofis-is': 'electronics',
};

export function resolveMarketplaceCategory(categoryId: string): Product['category'] {
  const [rootSlug] = getCategorySlugPath(categoryId);
  return catalogRootToLegacyCategory[rootSlug ?? categoryId] ?? 'women';
}

export function resolveListingImage(categoryId: string): string {
  const marketplaceCategory = resolveMarketplaceCategory(categoryId);
  return listingImagesByCategory[marketplaceCategory]
    ?? 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&q=80';
}

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm']);

function isVideoUrl(url: string): boolean {
  const cleanUrl = url.split('?')[0].toLowerCase();
  const ext = cleanUrl.split('.').pop() ?? '';
  return VIDEO_EXTENSIONS.has(ext);
}

export function mapListingToProduct(listing: Listing): Product {
  const orderedMedia = [...(listing.listing_images ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => image.url);
  const videoUri = orderedMedia.find((url) => isVideoUrl(url));
  const imageMedia = orderedMedia.filter((url) => !isVideoUrl(url));
  const coverImage =
    listing.listing_images?.find((image) => image.is_cover)?.url ??
    imageMedia[0] ??
    videoUri ??
    resolveListingImage(listing.category_id ?? 'women');

  const brandName =
    listing.profiles?.full_name?.trim() ||
    listing.profiles?.username?.trim() ||
    'Sipariş Kutusu';

  const favoriteCount = listing.like_count ?? listing.favorite_count ?? 0;
  const normalizedDescription = (listing.description ?? '').toLocaleLowerCase('tr-TR');
  const hasFreeShippingTag =
    normalizedDescription.includes('#ucretsizkargo') ||
    normalizedDescription.includes('ucretsiz kargo') ||
    normalizedDescription.includes('ücretsiz kargo');

  return {
    id: listing.id,
    sellerId: listing.seller_id,
    storeId: listing.store_id ?? undefined,
    title: listing.title,
    brand: brandName,
    description: listing.description ?? undefined,
    price: listing.price,
    originalPrice: listing.original_price ?? undefined,
    discount:
      listing.price > 0 && listing.original_price && listing.original_price > listing.price
        ? Math.round(
            ((listing.original_price - listing.price) / listing.original_price) * 100,
          )
        : undefined,
    rating: 4.7,
    reviewCount: Number(listing.comment_count ?? 0),
    favoriteCount:
      favoriteCount >= 1000
        ? `${(favoriteCount / 1000).toFixed(1)}B`
        : String(favoriteCount),
    image: coverImage,
    mediaUris: orderedMedia.length > 0 ? orderedMedia : [coverImage],
    videoUri,
    badge: listing.status === 'active' ? 'Yeni İlan' : undefined,
    freeShipping: hasFreeShippingTag,
    category: resolveMarketplaceCategory(listing.category_id ?? 'women'),
    condition: listing.condition,
    location: listing.city ?? undefined,
    district: listing.district ?? undefined,
    delivery:
      listing.delivery === 'both'
        ? ['Kargo', 'Elden Teslim']
        : listing.delivery === 'shipping'
          ? ['Kargo']
          : ['Elden Teslim'],
    stock: listing.stock,
  };
}
