/**
 * useFavorites.ts
 * Kullanıcının favori ilanlarını Supabase'den çeker, ekleme/çıkarma yapar.
 * Giriş yapılmamışsa ya da Supabase yoksa boş liste döner.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchFavorites,
  isFavorited,
  toggleFavorite,
} from '../services/favoriteService';
import { isSupabaseConfigured } from '../services/supabase';
import { captureError } from '../services/monitoring';
import { mapListingToProduct } from '../utils/listingMapper';
import { useAuth } from '../context/AuthContext';
import type { Product } from '../data/mockData';
import { getCacheValue, setCacheValue } from '../services/noSqlStore';
import { FAVORITES_CACHE_PREFIX, buildUserScopedCacheKey } from '../constants/cacheKeys';

const FAVORITES_CACHE_TTL_MS = 10 * 60_000;

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);
  const favoritesCacheKey = user?.id ? buildUserScopedCacheKey(FAVORITES_CACHE_PREFIX, user.id) : null;

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
      if (mountedRef.current) {
        setFavorites([]);
      }
      return;
    }

    if (!isSupabaseConfigured) {
      await loadFavoritesFromCache();
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
  }, [favoritesCacheKey, loadFavoritesFromCache, user?.id]);

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
      if (!isSupabaseConfigured || !user || user.id.startsWith('demo-')) return false;
      try {
        return await isFavorited(listingId);
      } catch {
        return false;
      }
    },
    [user?.id],
  );

  /** Favori ekle/çıkar → boolean (yeni durum) */
  const toggle = useCallback(
    async (listingId: string): Promise<boolean> => {
      if (!isSupabaseConfigured || !user || user.id.startsWith('demo-')) {
        return false;
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
    [user?.id, load],
  );

  return { favorites, loading, refresh: load, checkFavorited, toggle };
}
