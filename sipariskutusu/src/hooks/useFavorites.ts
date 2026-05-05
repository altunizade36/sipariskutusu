/**
 * useFavorites.ts
 * Kullanıcının favori ilanlarını Supabase'den çeker, ekleme/çıkarma yapar.
 * Giriş yapılmamışsa ya da Supabase yoksa boş liste döner.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchFavorites,
  isFavorited,
  toggleFavorite,
} from '../services/favoriteService';
import { isSupabaseConfigured } from '../services/supabase';
import { captureError } from '../services/monitoring';
import { mapListingToProduct } from '../utils/listingMapper';
import { useAuth } from '../context/AuthContext';
import { useListings } from '../context/ListingsContext';
import type { Product } from '../data/mockData';
import { getCacheValue, setCacheValue } from '../services/noSqlStore';
import { FAVORITES_CACHE_PREFIX, buildUserScopedCacheKey } from '../constants/cacheKeys';

const FAVORITES_CACHE_TTL_MS = 10 * 60_000;
const LOCAL_FAVORITES_KEY_PREFIX = 'favorites:local:v1';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function useFavorites() {
  const { user } = useAuth();
  const { allProducts } = useListings();
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [localFavoriteIds, setLocalFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);
  const favoritesCacheKey = user?.id ? buildUserScopedCacheKey(FAVORITES_CACHE_PREFIX, user.id) : null;
  const localFavoritesKey = `${LOCAL_FAVORITES_KEY_PREFIX}:${user?.id ?? 'guest'}`;

  const hydrateLocalFavorites = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      setFavorites(allProducts.filter((product) => idSet.has(product.id)));
    },
    [allProducts],
  );

  const loadLocalFavorites = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(localFavoritesKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const ids = Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
      if (!mountedRef.current) return;
      setLocalFavoriteIds(ids);
      hydrateLocalFavorites(ids);
    } catch {
      if (!mountedRef.current) return;
      setLocalFavoriteIds([]);
      setFavorites([]);
    }
  }, [hydrateLocalFavorites, localFavoritesKey]);

  const loadFavoritesFromCache = useCallback(async () => {
    if (!favoritesCacheKey) {
      return;
    }

    try {
      const cached = await getCacheValue<Product[]>(favoritesCacheKey);
      if (!cached || !mountedRef.current) {
        return;
      }

      setFavorites(cached);
    } catch {
      // Cache read hatası, canlı akışı bloklamamalı.
    }
  }, [favoritesCacheKey]);

  const load = useCallback(async () => {
    if (!user || user.id.startsWith('demo-')) {
      await loadLocalFavorites();
      return;
    }

    if (!isSupabaseConfigured) {
      await loadLocalFavorites();
      return;
    }

    setLoading(true);
    try {
      const listings = await fetchFavorites();
      if (!mountedRef.current) return;
      const mapped = listings.map(mapListingToProduct);
      setFavorites(mapped);
      if (favoritesCacheKey) {
        setCacheValue(favoritesCacheKey, mapped, { ttlMs: FAVORITES_CACHE_TTL_MS }).catch(() => {
          // Cache write hatası, canlı akışı bloklamamalı.
        });
      }
    } catch (err) {
      captureError(err, { scope: 'useFavorites_load' });
      await loadFavoritesFromCache();
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [favoritesCacheKey, loadFavoritesFromCache, loadLocalFavorites, user?.id]);

  useEffect(() => {
    if (isSupabaseConfigured && user && !user.id.startsWith('demo-')) {
      return;
    }

    hydrateLocalFavorites(localFavoriteIds);
  }, [allProducts, hydrateLocalFavorites, localFavoriteIds, user?.id]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  /** Belirli bir ilan favori mi? (anlık kontrol) */
  const checkFavorited = useCallback(
    async (listingId: string): Promise<boolean> => {
      if (!isSupabaseConfigured || !user || user.id.startsWith('demo-') || !isUuid(listingId)) {
        return localFavoriteIds.includes(listingId);
      }
      try {
        return await isFavorited(listingId);
      } catch {
        return false;
      }
    },
    [localFavoriteIds, user?.id],
  );

  /** Favori ekle/çıkar → boolean (yeni durum) */
  const toggle = useCallback(
    async (listingId: string): Promise<boolean> => {
      if (!isSupabaseConfigured || !user || user.id.startsWith('demo-') || !isUuid(listingId)) {
        const nextIds = localFavoriteIds.includes(listingId)
          ? localFavoriteIds.filter((id) => id !== listingId)
          : [listingId, ...localFavoriteIds];

        setLocalFavoriteIds(nextIds);
        hydrateLocalFavorites(nextIds);
        await AsyncStorage.setItem(localFavoritesKey, JSON.stringify(nextIds)).catch(() => undefined);
        return nextIds.includes(listingId);
      }
      try {
        const isNowFavorited = await toggleFavorite(listingId);
        // Listeyi yeniden çek
        await load();
        return isNowFavorited;
      } catch (err) {
        captureError(err, { scope: 'useFavorites_toggle' });
        return false;
      }
    },
    [hydrateLocalFavorites, localFavoriteIds, localFavoritesKey, user?.id, load],
  );

  return { favorites, loading, refresh: load, checkFavorited, toggle };
}
