import { Injectable } from '@nestjs/common';
import {
  DEFAULT_CACHE_LOCK_TTL_SECONDS,
  DEFAULT_METRIC_TTL_SECONDS,
  DEFAULT_PRODUCT_CACHE_TTL_SECONDS,
  DEFAULT_PRODUCT_NEGATIVE_CACHE_TTL_SECONDS,
  DEFAULT_PRODUCT_SEARCH_CACHE_TTL_SECONDS,
  DEFAULT_PRODUCT_STALE_FALLBACK_TTL_SECONDS,
  PRODUCT_SEARCH_CACHE_VERSION_KEY,
} from '../constants/performance.constants';
import { buildCacheKey } from '../utils/cache-key.util';
import { RedisService } from './redis.service';

const NEGATIVE_CACHE_SENTINEL = '__NOT_FOUND__';
const STALE_FALLBACK_SUFFIX = ':stale-shadow';

@Injectable()
export class ProductCacheService {
  constructor(private readonly redisService: RedisService) {}

  private async bumpMetric(metric: 'hit' | 'miss' | 'set' | 'error' | 'negative_hit' | 'negative_set' | 'stale_fallback_hit') {
    const key = buildCacheKey('product:metric', { metric });
    try {
      await this.redisService.client.multi().incr(key).expire(key, DEFAULT_METRIC_TTL_SECONDS).exec();
    } catch {
      // Metrics are best-effort and should never break read paths.
    }
  }

  private async withCacheLock<T>(
    lockKey: string,
    resolver: () => Promise<T>,
    lockTtlSeconds = DEFAULT_CACHE_LOCK_TTL_SECONDS,
  ): Promise<T> {
    const lockToken = `${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    const acquired = await this.redisService.client.set(lockKey, lockToken, 'EX', lockTtlSeconds, 'NX');

    if (!acquired) {
      // Another worker is likely refreshing. Short waits reduce origin stampede.
      await new Promise((resolve) => setTimeout(resolve, 40));
      await new Promise((resolve) => setTimeout(resolve, 60));
      await new Promise((resolve) => setTimeout(resolve, 90));
      return resolver();
    }

    try {
      return await resolver();
    } finally {
      const releaseScript = `
        if redis.call('GET', KEYS[1]) == ARGV[1] then
          return redis.call('DEL', KEYS[1])
        end
        return 0
      `;
      await this.redisService.client.eval(releaseScript, 1, lockKey, lockToken);
    }
  }

  private async getSearchNamespaceVersion() {
    const namespacedKey = buildCacheKey(PRODUCT_SEARCH_CACHE_VERSION_KEY, {});
    const current = await this.redisService.client.get(namespacedKey);
    if (current) {
      return current;
    }

    await this.redisService.client.set(namespacedKey, '1');
    return '1';
  }

  async getOrSetProductById<T extends object>(
    productId: string,
    resolver: () => Promise<T | null>,
    ttlSeconds = DEFAULT_PRODUCT_CACHE_TTL_SECONDS,
    negativeTtlSeconds = DEFAULT_PRODUCT_NEGATIVE_CACHE_TTL_SECONDS,
    staleFallbackTtlSeconds = DEFAULT_PRODUCT_STALE_FALLBACK_TTL_SECONDS,
  ): Promise<T | null> {
    const key = buildCacheKey('product:detail', { productId });
    const staleShadowKey = `${key}${STALE_FALLBACK_SUFFIX}`;
    const lockKey = buildCacheKey('lock:product:detail', { productId });
    const cached = await this.redisService.client.get(key).catch(() => null);
    if (cached) {
      if (cached === NEGATIVE_CACHE_SENTINEL) {
        await this.bumpMetric('negative_hit');
        return null;
      }
      await this.bumpMetric('hit');
      return JSON.parse(cached) as T;
    }

    await this.bumpMetric('miss');

    const resolved = await this.withCacheLock(lockKey, async () => {
      const secondRead = await this.redisService.client.get(key).catch(() => null);
      if (secondRead) {
        if (secondRead === NEGATIVE_CACHE_SENTINEL) {
          await this.bumpMetric('negative_hit');
          return null;
        }
        await this.bumpMetric('hit');
        return JSON.parse(secondRead) as T;
      }

      try {
        return await resolver();
      } catch {
        const stale = await this.redisService.client.get(staleShadowKey).catch(() => null);
        if (stale && stale !== NEGATIVE_CACHE_SENTINEL) {
          await this.bumpMetric('stale_fallback_hit');
          return JSON.parse(stale) as T;
        }

        throw new Error('product-resolver-failed-without-stale-fallback');
      }
    });

    if (!resolved) {
      await this.redisService.client.set(key, NEGATIVE_CACHE_SENTINEL, 'EX', negativeTtlSeconds).catch(async () => {
        await this.bumpMetric('error');
      });
      await this.bumpMetric('negative_set');
      return null;
    }

    await this.redisService.client.set(key, JSON.stringify(resolved), 'EX', ttlSeconds).catch(async () => {
      await this.bumpMetric('error');
    });
    await this.redisService.client.set(staleShadowKey, JSON.stringify(resolved), 'EX', staleFallbackTtlSeconds).catch(async () => {
      await this.bumpMetric('error');
    });
    await this.bumpMetric('set');
    return resolved;
  }

  async getOrSetProductSearch<T extends object>(
    query: Record<string, unknown>,
    resolver: () => Promise<T>,
    ttlSeconds = DEFAULT_PRODUCT_SEARCH_CACHE_TTL_SECONDS,
    staleFallbackTtlSeconds = DEFAULT_PRODUCT_STALE_FALLBACK_TTL_SECONDS,
  ): Promise<T> {
    const namespaceVersion = await this.getSearchNamespaceVersion();
    const key = buildCacheKey('product:search', { namespaceVersion, ...query });
    const staleShadowKey = `${key}${STALE_FALLBACK_SUFFIX}`;
    const lockKey = buildCacheKey('lock:product:search', { namespaceVersion, ...query });
    const cached = await this.redisService.client.get(key).catch(() => null);
    if (cached) {
      await this.bumpMetric('hit');
      return JSON.parse(cached) as T;
    }

    await this.bumpMetric('miss');

    const resolved = await this.withCacheLock(lockKey, async () => {
      const secondRead = await this.redisService.client.get(key).catch(() => null);
      if (secondRead) {
        await this.bumpMetric('hit');
        return JSON.parse(secondRead) as T;
      }

      try {
        return await resolver();
      } catch {
        const stale = await this.redisService.client.get(staleShadowKey).catch(() => null);
        if (stale && stale !== NEGATIVE_CACHE_SENTINEL) {
          await this.bumpMetric('stale_fallback_hit');
          return JSON.parse(stale) as T;
        }

        throw new Error('search-resolver-failed-without-stale-fallback');
      }
    });

    await this.redisService.client.set(key, JSON.stringify(resolved), 'EX', ttlSeconds).catch(async () => {
      await this.bumpMetric('error');
    });
    await this.redisService.client.set(staleShadowKey, JSON.stringify(resolved), 'EX', staleFallbackTtlSeconds).catch(async () => {
      await this.bumpMetric('error');
    });
    await this.bumpMetric('set');
    return resolved;
  }

  async invalidateProduct(productId: string) {
    const detailKey = buildCacheKey('product:detail', { productId });
    await this.redisService.client.del(detailKey);

    // O(1) namespace bump invalidates all product search caches without SCAN storms.
    const namespacedKey = buildCacheKey(PRODUCT_SEARCH_CACHE_VERSION_KEY, {});
    await this.redisService.client.incr(namespacedKey);
  }

  async getCacheStats() {
    const keys = {
      hit: buildCacheKey('product:metric', { metric: 'hit' }),
      miss: buildCacheKey('product:metric', { metric: 'miss' }),
      set: buildCacheKey('product:metric', { metric: 'set' }),
      error: buildCacheKey('product:metric', { metric: 'error' }),
      negativeHit: buildCacheKey('product:metric', { metric: 'negative_hit' }),
      negativeSet: buildCacheKey('product:metric', { metric: 'negative_set' }),
      staleFallbackHit: buildCacheKey('product:metric', { metric: 'stale_fallback_hit' }),
    };

    const [hit, miss, set, error, negativeHit, negativeSet, staleFallbackHit] = await this.redisService.client.mget(
      keys.hit,
      keys.miss,
      keys.set,
      keys.error,
      keys.negativeHit,
      keys.negativeSet,
      keys.staleFallbackHit,
    );
    const hitCount = Number(hit ?? 0);
    const missCount = Number(miss ?? 0);
    const negativeHitCount = Number(negativeHit ?? 0);
    const negativeSetCount = Number(negativeSet ?? 0);
    const totalRead = hitCount + missCount;

    return {
      hit: hitCount,
      miss: missCount,
      set: Number(set ?? 0),
      error: Number(error ?? 0),
      negativeHit: negativeHitCount,
      negativeSet: negativeSetCount,
      staleFallbackHit: Number(staleFallbackHit ?? 0),
      hitRatio: totalRead > 0 ? Number((hitCount / totalRead).toFixed(4)) : 0,
    };
  }
}
