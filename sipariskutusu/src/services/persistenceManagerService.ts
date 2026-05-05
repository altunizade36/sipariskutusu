import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PersistenceConfig {
  prefix?: string;
  ttl?: number;
  maxSize?: number;
}

export interface PersistedData<T = any> {
  value: T;
  timestamp: number;
  version: number;
}

export class PersistenceManager {
  private static config: PersistenceConfig = {
    prefix: 'app:persist:',
    ttl: Infinity,
    maxSize: 100,
  };

  static configure(config: Partial<PersistenceConfig>) {
    this.config = { ...this.config, ...config };
  }

  private static getKey(key: string): string {
    return `${this.config.prefix}${key}`;
  }

  static async save<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const data: PersistedData<T> = {
        value,
        timestamp: Date.now(),
        version: 1,
      };

      const storageKey = this.getKey(key);
      await AsyncStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
      console.error(`Failed to save ${key}:`, error);
      throw error;
    }
  }

  static async load<T = any>(key: string, options: { ttl?: number } = {}): Promise<T | null> {
    try {
      const storageKey = this.getKey(key);
      const data = await AsyncStorage.getItem(storageKey);

      if (!data) return null;

      const parsed: PersistedData<T> = JSON.parse(data);
      const ttl = options.ttl ?? this.config.ttl;

      // Check TTL
      if (ttl !== Infinity && Date.now() - parsed.timestamp > ttl) {
        await this.remove(key);
        return null;
      }

      return parsed.value;
    } catch (error) {
      console.error(`Failed to load ${key}:`, error);
      return null;
    }
  }

  static async loadOrSave<T = any>(
    key: string,
    fallback: () => Promise<T> | T,
    options: { ttl?: number } = {},
  ): Promise<T> {
    const existing = await this.load<T>(key, options);
    if (existing !== null) return existing;

    const value = await Promise.resolve(fallback());
    await this.save(key, value);
    return value;
  }

  static async remove(key: string): Promise<void> {
    try {
      const storageKey = this.getKey(key);
      await AsyncStorage.removeItem(storageKey);
    } catch (error) {
      console.error(`Failed to remove ${key}:`, error);
    }
  }

  static async exists(key: string): Promise<boolean> {
    try {
      const storageKey = this.getKey(key);
      const value = await AsyncStorage.getItem(storageKey);
      return value !== null;
    } catch {
      return false;
    }
  }

  static async getAll(): Promise<Record<string, any>> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const prefixedKeys = keys.filter((k) => k.startsWith(this.config.prefix || ''));

      const result: Record<string, any> = {};

      for (const key of prefixedKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          const originalKey = key.replace(this.config.prefix || '', '');
          result[originalKey] = parsed.value;
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to get all items:', error);
      return {};
    }
  }

  static async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const prefixedKeys = keys.filter((k) => k.startsWith(this.config.prefix || ''));
      await AsyncStorage.multiRemove(prefixedKeys);
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  }

  static async getMetadata(key: string): Promise<PersistedData | null> {
    try {
      const storageKey = this.getKey(key);
      const data = await AsyncStorage.getItem(storageKey);

      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.error(`Failed to get metadata for ${key}:`, error);
      return null;
    }
  }

  static async getStats(): Promise<{
    keys: number;
    size: number;
    oldestKey?: string;
    newestKey?: string;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const prefixedKeys = keys.filter((k) => k.startsWith(this.config.prefix || ''));

      let oldest: { key: string; timestamp: number } | undefined;
      let newest: { key: string; timestamp: number } | undefined;
      let totalSize = 0;

      for (const key of prefixedKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += data.length;
          const parsed: PersistedData = JSON.parse(data);

          if (!oldest || parsed.timestamp < oldest.timestamp) {
            oldest = { key, timestamp: parsed.timestamp };
          }
          if (!newest || parsed.timestamp > newest.timestamp) {
            newest = { key, timestamp: parsed.timestamp };
          }
        }
      }

      return {
        keys: prefixedKeys.length,
        size: totalSize,
        oldestKey: oldest?.key,
        newestKey: newest?.key,
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return { keys: 0, size: 0 };
    }
  }
}
