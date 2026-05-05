import { Injectable } from '@nestjs/common';
import {
  DEFAULT_METRIC_TTL_SECONDS,
  DEFAULT_RATE_LIMIT_MAX_REQUESTS,
  DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
} from '../constants/performance.constants';
import type { RateLimitOptions } from '../interfaces/cache-options.interface';
import { buildCacheKey } from '../utils/cache-key.util';
import { RedisService } from './redis.service';

export interface RateLimitResult {
  allowed: boolean;
  maxRequests: number;
  remaining: number;
  resetAtUnixMs: number;
  retryAfterSeconds: number;
}

@Injectable()
export class RateLimitService {
  constructor(private readonly redisService: RedisService) {}

  private async bumpMetric(
    metric:
      | 'allowed'
      | 'blocked'
      | 'error'
      | 'fallback_emergency'
      | 'fallback_fail_open'
      | 'ban_triggered'
      | 'ban_blocked',
  ) {
    const key = buildCacheKey('rate-limit:metric', { metric });

    try {
      await this.redisService.client.multi().incr(key).expire(key, DEFAULT_METRIC_TTL_SECONDS).exec();
    } catch {
      // Rate-limit metrics are best-effort.
    }
  }

  async recordFallback(mode: 'emergency' | 'fail_open') {
    if (mode === 'emergency') {
      await this.bumpMetric('fallback_emergency');
      return;
    }

    await this.bumpMetric('fallback_fail_open');
  }

  async recordBanEvent(mode: 'triggered' | 'blocked') {
    if (mode === 'triggered') {
      await this.bumpMetric('ban_triggered');
      return;
    }

    await this.bumpMetric('ban_blocked');
  }

  async getRateLimitStats() {
    const keys = {
      allowed: buildCacheKey('rate-limit:metric', { metric: 'allowed' }),
      blocked: buildCacheKey('rate-limit:metric', { metric: 'blocked' }),
      error: buildCacheKey('rate-limit:metric', { metric: 'error' }),
      fallbackEmergency: buildCacheKey('rate-limit:metric', { metric: 'fallback_emergency' }),
      fallbackFailOpen: buildCacheKey('rate-limit:metric', { metric: 'fallback_fail_open' }),
      banTriggered: buildCacheKey('rate-limit:metric', { metric: 'ban_triggered' }),
      banBlocked: buildCacheKey('rate-limit:metric', { metric: 'ban_blocked' }),
    };

    const [allowed, blocked, error, fallbackEmergency, fallbackFailOpen, banTriggered, banBlocked] = await this.redisService.client.mget(
      keys.allowed,
      keys.blocked,
      keys.error,
      keys.fallbackEmergency,
      keys.fallbackFailOpen,
      keys.banTriggered,
      keys.banBlocked,
    );

    const allowedNum = Number(allowed ?? 0);
    const blockedNum = Number(blocked ?? 0);

    return {
      allowed: allowedNum,
      blocked: blockedNum,
      error: Number(error ?? 0),
      fallbackEmergency: Number(fallbackEmergency ?? 0),
      fallbackFailOpen: Number(fallbackFailOpen ?? 0),
      banTriggered: Number(banTriggered ?? 0),
      banBlocked: Number(banBlocked ?? 0),
      blockRatio: allowedNum + blockedNum > 0 ? Number((blockedNum / (allowedNum + blockedNum)).toFixed(4)) : 0,
    };
  }

  private readonly slidingWindowScript = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local window_ms = tonumber(ARGV[2])
    local max_requests = tonumber(ARGV[3])
    local member = ARGV[4]

    redis.call('ZREMRANGEBYSCORE', key, 0, now - window_ms)
    redis.call('ZADD', key, now, member)
    local count = redis.call('ZCARD', key)
    redis.call('PEXPIRE', key, window_ms)

    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local oldest_score = now
    if oldest[2] then
      oldest_score = tonumber(oldest[2])
    end

    local reset_at = oldest_score + window_ms
    local allowed = 1
    if count > max_requests then
      allowed = 0
    end

    return {allowed, count, reset_at}
  `;

  async checkLimit(identifier: string, options?: Partial<RateLimitOptions>): Promise<RateLimitResult> {
    const maxRequests = options?.maxRequests ?? DEFAULT_RATE_LIMIT_MAX_REQUESTS;
    const windowSeconds = options?.windowSeconds ?? DEFAULT_RATE_LIMIT_WINDOW_SECONDS;
    const keyPrefix = options?.keyPrefix ?? 'rate-limit';

    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const key = buildCacheKey(keyPrefix, { identifier });
    const member = `${now}:${Math.random().toString(36).slice(2, 12)}`;

    if (this.redisService.isDegraded()) {
      throw new Error('rate-limit-redis-degraded');
    }

    const scriptResult = await this.redisService
      .execute('rate-limit-eval', () =>
        this.redisService.client.eval(
          this.slidingWindowScript,
          1,
          key,
          now,
          windowMs,
          maxRequests,
          member,
        ),
      )
      .catch(async (error) => {
        await this.bumpMetric('error');
        throw error;
      });

    const [allowedAsInt, countRaw, resetAtRaw] = Array.isArray(scriptResult)
      ? scriptResult
      : [1, 0, now + windowMs];

    const count = Number(countRaw ?? 0);
    const resetAtUnixMs = Number(resetAtRaw ?? now + windowMs);

    const allowed = Number(allowedAsInt ?? 1) === 1;
    const remaining = Math.max(0, maxRequests - count);
    const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil((resetAtUnixMs - now) / 1000));

    await this.bumpMetric(allowed ? 'allowed' : 'blocked');

    return {
      allowed,
      maxRequests,
      remaining,
      resetAtUnixMs,
      retryAfterSeconds,
    };
  }
}
