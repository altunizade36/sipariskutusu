import { Injectable } from '@nestjs/common';
import { RATE_LIMIT_FAIL_OPEN } from '../constants/performance.constants';
import { ProductCacheService } from './product-cache.service';
import { QueueService } from './queue.service';
import { RateLimitService } from './rate-limit.service';
import { RedisService } from './redis.service';
import { SessionStoreService } from './session-store.service';

@Injectable()
export class OpsService {
  constructor(
    private readonly redisService: RedisService,
    private readonly productCacheService: ProductCacheService,
    private readonly rateLimitService: RateLimitService,
    private readonly sessionStoreService: SessionStoreService,
    private readonly queueService: QueueService,
  ) {}

  getLiveness() {
    return {
      status: 'ok',
      service: 'backend-performance',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      memory: process.memoryUsage(),
    };
  }

  async getReadiness() {
    const redis = await this.redisService.ping();
    const status = redis.ok ? 'ready' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      dependencies: {
        redis,
      },
    };
  }

  getSecurityPosture() {
    return {
      rateLimitFailOpen: RATE_LIMIT_FAIL_OPEN,
      corsAllowedOriginsConfigured: Boolean(process.env.CORS_ALLOWED_ORIGINS?.trim()),
      trustedProxy: process.env.HTTP_TRUST_PROXY ?? '1',
      bodyLimit: process.env.HTTP_BODY_LIMIT ?? '1mb',
      rawSessionMetadataStored: (process.env.STORE_RAW_SESSION_METADATA ?? 'false').toLowerCase() === 'true',
      requestIdEnabled: true,
      securityHeadersEnabled: true,
      releaseGateRequired: (process.env.REQUIRE_REDIS_HEALTH ?? 'true').toLowerCase() === 'true',
    };
  }

  getRuntimeConfigSummary() {
    return {
      nodeEnv: process.env.NODE_ENV ?? 'development',
      port: Number(process.env.PORT ?? 4100),
      redisUrlConfigured: Boolean(process.env.REDIS_URL),
      redisKeyPrefix: process.env.REDIS_KEY_PREFIX ?? 'sipariskutusu',
      corsMaxAgeSeconds: Number(process.env.CORS_MAX_AGE_SECONDS ?? 600),
      queueRetentionSeconds: Number(process.env.QUEUE_MESSAGE_RETENTION_SECONDS ?? 60 * 60 * 24),
      releaseGateThresholds: {
        maxCacheErrorMetric: Number(process.env.RELEASE_MAX_CACHE_ERROR_METRIC ?? 0),
        maxRateLimitErrorMetric: Number(process.env.RELEASE_MAX_RATE_LIMIT_ERROR_METRIC ?? 0),
        maxFallbackEmergencyMetric: Number(process.env.RELEASE_MAX_RATE_LIMIT_FALLBACK_EMERGENCY ?? 0),
        maxBanBlockedMetric: Number(process.env.RELEASE_MAX_BAN_BLOCKED_METRIC ?? 1_000_000),
        maxSessionEvictedMetric: Number(process.env.RELEASE_MAX_SESSION_EVICTED_METRIC ?? 1_000_000),
      },
    };
  }

  async getOperationsOverview() {
    const [readiness, cache, rateLimit, sessions, queue] = await Promise.all([
      this.getReadiness(),
      this.productCacheService.getCacheStats(),
      this.rateLimitService.getRateLimitStats(),
      this.sessionStoreService.getSessionStats(),
      this.queueService.getQueueStats(process.env.DEFAULT_QUEUE_NAME ?? 'default'),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      readiness,
      security: this.getSecurityPosture(),
      runtime: this.getRuntimeConfigSummary(),
      cache,
      rateLimit,
      sessions,
      queue,
    };
  }
}