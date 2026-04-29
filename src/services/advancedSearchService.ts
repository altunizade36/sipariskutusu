/**
 * advancedSearchService.ts
 * Unified product + store search with @instagram priority and Turkish char support.
 */

import { getSupabaseClient } from './supabase';
import { fetchListings, SearchFilters, Listing } from './listingService';

export type StoreSearchResult = {
  store_id: string;
  seller_id: string;
  store_name: string;
  instagram_username: string | null;
  bio: string | null;
  city: string | null;
  category: string | null;
  verified_seller: boolean;
  rating: number;
  follower_count: number;
  product_count: number;
  avatar_url: string | null;
  instagram_priority: boolean;
};

export type SearchSortOption = 'newest' | 'price_asc' | 'price_desc' | 'most_liked' | 'most_commented';
export type StoreSortOption = 'relevance' | 'rating' | 'most_followers' | 'most_products';

export type UnifiedSearchFilters = {
  query?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  city?: string;
  district?: string;
  sort?: SearchSortOption;
  storeSort?: StoreSortOption;
  page?: number;
  pageSize?: number;
};

export type UnifiedSearchResult = {
  products: Listing[];
  stores: StoreSearchResult[];
  hasMoreProducts: boolean;
  hasMoreStores: boolean;
};

/** Normalise Turkish characters for consistent matching */
function normalizeTr(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

export function isInstagramQuery(query: string): boolean {
  return query.trimStart().startsWith('@');
}

export async function searchStores(
  query: string | undefined,
  filters: Omit<UnifiedSearchFilters, 'query' | 'sort'> & { storeSort?: StoreSortOption } = {},
  page = 1,
  pageSize = 20,
): Promise<{ stores: StoreSearchResult[]; hasMore: boolean }> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('search_stores_rpc', {
    p_query: query ?? null,
    p_category: filters.categoryId ?? null,
    p_city: filters.city ?? null,
    p_sort: filters.storeSort ?? 'relevance',
    p_page: page,
    p_page_size: pageSize + 1, // fetch one extra to detect hasMore
  });

  if (error) {
    console.error('[advancedSearchService] searchStores error:', error);
    return { stores: [], hasMore: false };
  }

  const rows = (data ?? []) as StoreSearchResult[];
  const hasMore = rows.length > pageSize;
  return { stores: hasMore ? rows.slice(0, pageSize) : rows, hasMore };
}

export async function unifiedSearch(
  filters: UnifiedSearchFilters,
): Promise<UnifiedSearchResult> {
  const { query, page = 1, pageSize = 20 } = filters;

  const listingFilters: SearchFilters = {
    query,
    categoryId: filters.categoryId,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    city: filters.city,
    district: filters.district,
    sort: filters.sort,
    // fetchListings uses 0-based page index
    page: page - 1,
    pageSize: pageSize + 1,
  };

  // Run both searches in parallel
  const [productsRaw, storeResult] = await Promise.all([
    fetchListings(listingFilters),
    searchStores(query, { categoryId: filters.categoryId, city: filters.city, storeSort: filters.storeSort }, page, pageSize),
  ]);

  const hasMoreProducts = productsRaw.length > pageSize;
  const products = hasMoreProducts ? productsRaw.slice(0, pageSize) : productsRaw;

  return {
    products,
    stores: storeResult.stores,
    hasMoreProducts,
    hasMoreStores: storeResult.hasMore,
  };
}
