/**
 * useProducts.ts
 * Supabase'den ürün çekme, sayfalama, yenileme.
 * Supabase yapılandırılmamışsa context'teki mock veri kullanılır.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchListings, type SearchFilters } from '../services/listingService';
import { isSupabaseConfigured } from '../services/supabase';
import { captureError } from '../services/monitoring';
import { mapListingToProduct } from '../utils/listingMapper';
import { useListings } from '../context/ListingsContext';
import type { Product } from '../data/mockData';
import { getCacheValue, setCacheValue } from '../services/noSqlStore';
import { PRODUCTS_CACHE_PREFIX } from '../constants/cacheKeys';

const PAGE_SIZE = 20;
const PRODUCTS_CACHE_TTL_MS = 10 * 60_000;

function buildProductsCacheKey(filters: SearchFilters, pageSize: number) {
  return `${PRODUCTS_CACHE_PREFIX}:${JSON.stringify(filters)}:${pageSize}`;
}

export type UseProductsOptions = {
  filters?: SearchFilters;
  pageSize?: number;
  /** false olursa Supabase sorgusu yapılmaz, context verisi döner */
  enabled?: boolean;
};

export function useProducts({
  filters = {},
  pageSize = PAGE_SIZE,
  enabled = true,
}: UseProductsOptions = {}) {
  const { allProducts } = useListings();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const mountedRef = useRef(true);
  const cacheKey = buildProductsCacheKey(filters, pageSize);
  // Filtre değişimini izlemek için string anahtar
  const filterKey = JSON.stringify(filters);

  const load = useCallback(
    async (reset: boolean) => {
      if (!isSupabaseConfigured || !enabled) return;
      const targetPage = reset ? 0 : pageRef.current;
      setLoading(true);
      try {
        const data = await fetchListings(filters, targetPage, pageSize);
        const mapped = data.map(mapListingToProduct);
        if (!mountedRef.current) return;
        if (reset) {
          setProducts(mapped);
          pageRef.current = 1;
          setCacheValue(cacheKey, mapped, { ttlMs: PRODUCTS_CACHE_TTL_MS }).catch(() => {
            // Cache write hatası UX'i bloklamamalı.
          });
        } else {
          setProducts((prev) => [...prev, ...mapped]);
          pageRef.current = targetPage + 1;
        }
        setHasMore(data.length === pageSize);
      } catch (err) {
        captureError(err, { scope: 'useProducts_load' });
        if (reset) {
          try {
            const cachedProducts = await getCacheValue<Product[]>(cacheKey);
            if (cachedProducts && mountedRef.current) {
              setProducts(cachedProducts);
            }
          } catch {
            // Cache read hatası göz ardı edilir.
          }
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cacheKey, filterKey, pageSize, enabled],
  );

  useEffect(() => {
    mountedRef.current = true;
    load(true);
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, pageSize, enabled]);

  const refresh = useCallback(() => load(true), [load]);
  const loadMore = useCallback(() => {
    if (!loading && hasMore) load(false);
  }, [loading, hasMore, load]);

  // Supabase yoksa veya devre dışı bırakıldıysa context verisini döndür
  const displayProducts =
    isSupabaseConfigured && enabled ? products : allProducts;

  return { products: displayProducts, loading, refresh, loadMore, hasMore };
}
