import AsyncStorage from '@react-native-async-storage/async-storage';

type CacheEnvelope<T> = {
  value: T;
  expiresAt: number | null;
  createdAt: number;
};

type SetCacheOptions = {
  ttlMs?: number;
};

const MAX_SERIALIZED_SIZE = 200 * 1024;
const CACHE_KEY_REGISTRY_KEY = '__cache_registry_v1';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasEnvelopeShape<T>(value: unknown): value is CacheEnvelope<T> {
  if (!isObject(value)) {
    return false;
  }

  if (!('value' in value) || !('createdAt' in value) || !('expiresAt' in value)) {
    return false;
  }

  const createdAt = (value as { createdAt: unknown }).createdAt;
  const expiresAt = (value as { expiresAt: unknown }).expiresAt;

  return (
    typeof createdAt === 'number' &&
    Number.isFinite(createdAt) &&
    (expiresAt === null || (typeof expiresAt === 'number' && Number.isFinite(expiresAt)))
  );
}

async function getRegisteredCacheKeys() {
  const serialized = await AsyncStorage.getItem(CACHE_KEY_REGISTRY_KEY);
  if (!serialized) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(serialized) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    await AsyncStorage.removeItem(CACHE_KEY_REGISTRY_KEY);
    return [] as string[];
  }
}

async function registerCacheKey(key: string) {
  const keys = await getRegisteredCacheKeys();
  if (keys.includes(key)) {
    return;
  }

  keys.push(key);
  await AsyncStorage.setItem(CACHE_KEY_REGISTRY_KEY, JSON.stringify(keys));
}

async function unregisterCacheKey(key: string) {
  const keys = await getRegisteredCacheKeys();
  const nextKeys = keys.filter((entry) => entry !== key);

  if (nextKeys.length === 0) {
    await AsyncStorage.removeItem(CACHE_KEY_REGISTRY_KEY);
    return;
  }

  await AsyncStorage.setItem(CACHE_KEY_REGISTRY_KEY, JSON.stringify(nextKeys));
}

export async function setCacheValue<T>(
  key: string,
  value: T,
  options: SetCacheOptions = {},
): Promise<void> {
  const ttlMs = options.ttlMs;
  const envelope: CacheEnvelope<T> = {
    value,
    createdAt: Date.now(),
    expiresAt: typeof ttlMs === 'number' && ttlMs > 0 ? Date.now() + ttlMs : null,
  };

  const serialized = JSON.stringify(envelope);
  if (serialized.length > MAX_SERIALIZED_SIZE) {
    // Cache aşırı büyükse sessizce pas geçilir; ana akış etkilenmez.
    return;
  }

  await AsyncStorage.setItem(key, serialized);
  await registerCacheKey(key);
}

export async function getCacheValue<T>(key: string): Promise<T | null> {
  const serialized = await AsyncStorage.getItem(key);
  if (!serialized) {
    return null;
  }

  try {
    const parsed = JSON.parse(serialized) as unknown;

    if (hasEnvelopeShape<T>(parsed)) {
      if (parsed.expiresAt !== null && parsed.expiresAt <= Date.now()) {
        await AsyncStorage.removeItem(key);
        await unregisterCacheKey(key);
        return null;
      }

      return parsed.value;
    }

    // Eski düz JSON formatı ile uyumluluk.
    return parsed as T;
  } catch {
    await AsyncStorage.removeItem(key);
    await unregisterCacheKey(key);
    return null;
  }
}

export async function removeCacheValue(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
  await unregisterCacheKey(key);
}

export async function invalidateCacheByPrefix(prefix: string): Promise<void> {
  const keys = await getRegisteredCacheKeys();
  const matchingKeys = keys.filter((key) => key.startsWith(prefix));

  if (matchingKeys.length === 0) {
    return;
  }

  await AsyncStorage.multiRemove(matchingKeys);
  const nextKeys = keys.filter((key) => !key.startsWith(prefix));

  if (nextKeys.length === 0) {
    await AsyncStorage.removeItem(CACHE_KEY_REGISTRY_KEY);
    return;
  }

  await AsyncStorage.setItem(CACHE_KEY_REGISTRY_KEY, JSON.stringify(nextKeys));
}
