import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

const CACHE_META_KEY = '@sipariskutusu/cache_meta';
const CACHE_PREFIX = '@cache_';

export class SmartCacheManager {
  static async set<T>(key: string, value: T, ttlMinutes = 60): Promise<void> {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      const ttl = ttlMinutes * 60 * 1000;

      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: Date.now(),
        ttl,
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));

      // Update metadata
      const meta = await this.getCacheMeta();
      if (!meta[key]) {
        meta[key] = {
          key,
          size: JSON.stringify(value).length,
          created: Date.now(),
          accessed: Date.now(),
          hits: 0,
        };
      } else {
        meta[key].accessed = Date.now();
        meta[key].size = JSON.stringify(value).length;
      }
      await AsyncStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
    } catch (error) {
      console.error('Failed to set cache:', error);
    }
  }

  static async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      const data = await AsyncStorage.getItem(cacheKey);

      if (!data) return null;

      const entry: CacheEntry<T> = JSON.parse(data);
      const age = Date.now() - entry.timestamp;

      if (age > entry.ttl) {
        await this.remove(key);
        return null;
      }

      // Update hit count
      const meta = await this.getCacheMeta();
      if (meta[key]) {
        meta[key].hits += 1;
        meta[key].accessed = Date.now();
        await AsyncStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
      }

      return entry.value;
    } catch (error) {
      console.error('Failed to get cache:', error);
      return null;
    }
  }

  static async remove(key: string): Promise<void> {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      await AsyncStorage.removeItem(cacheKey);

      const meta = await this.getCacheMeta();
      delete meta[key];
      await AsyncStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
    } catch (error) {
      console.error('Failed to remove cache:', error);
    }
  }

  static async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove([...cacheKeys, CACHE_META_KEY]);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  static async getStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    oldestEntry?: { key: string; age: number };
    mostAccessed?: { key: string; hits: number };
  }> {
    try {
      const meta = await this.getCacheMeta();
      const entries = Object.values(meta) as any[];

      if (entries.length === 0) {
        return {
          totalEntries: 0,
          totalSize: 0,
        };
      }

      const totalSize = entries.reduce((sum, e) => sum + (e.size || 0), 0);
      const oldest = entries.reduce((min, e) =>
        (e.created || 0) < (min.created || 0) ? e : min,
      );
      const mostAccessed = entries.reduce((max, e) =>
        (e.hits || 0) > (max.hits || 0) ? e : max,
      );

      return {
        totalEntries: entries.length,
        totalSize,
        oldestEntry: {
          key: oldest.key,
          age: Date.now() - (oldest.created || 0),
        },
        mostAccessed: {
          key: mostAccessed.key,
          hits: mostAccessed.hits || 0,
        },
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return { totalEntries: 0, totalSize: 0 };
    }
  }

  static async cleanupExpired(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
      let cleanedCount = 0;

      for (const cacheKey of cacheKeys) {
        const data = await AsyncStorage.getItem(cacheKey);
        if (data) {
          const entry: CacheEntry<any> = JSON.parse(data);
          const age = Date.now() - entry.timestamp;
          if (age > entry.ttl) {
            await AsyncStorage.removeItem(cacheKey);
            cleanedCount++;
          }
        }
      }

      return cleanedCount;
    } catch (error) {
      console.error('Failed to cleanup expired cache:', error);
      return 0;
    }
  }

  static async getSize(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
      let totalSize = 0;

      for (const key of cacheKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += data.length;
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Failed to get cache size:', error);
      return 0;
    }
  }

  private static async getCacheMeta(): Promise<Record<string, any>> {
    try {
      const data = await AsyncStorage.getItem(CACHE_META_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      return {};
    }
  }
}
