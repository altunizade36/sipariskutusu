import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';
import { OpsController } from './controllers/ops.controller';
import { PerformanceDemoController } from './controllers/performance-demo.controller';
import { REDIS_CLIENT } from './constants/performance.constants';
import { AdminApiKeyGuard } from './guards/admin-api-key.guard';
import { RedisRateLimitGuard } from './guards/redis-rate-limit.guard';
import { CdnCacheInterceptor } from './interceptors/cdn-cache.interceptor';
import { ProductCacheInvalidationInterceptor } from './interceptors/product-cache-invalidation.interceptor';
import { OpsService } from './services/ops.service';
import { ProductCacheService } from './services/product-cache.service';
import { QueueService } from './services/queue.service';
import { RateLimitService } from './services/rate-limit.service';
import { RedisService } from './services/redis.service';
import { SessionStoreService } from './services/session-store.service';

@Module({
  controllers: [PerformanceDemoController, OpsController],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
        return new Redis(redisUrl, {
          maxRetriesPerRequest: Number(process.env.REDIS_MAX_RETRIES_PER_REQUEST ?? 1),
          enableOfflineQueue: false,
          lazyConnect: false,
          connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 1500),
          commandTimeout: Number(process.env.REDIS_COMMAND_TIMEOUT_MS ?? 1200),
          keepAlive: Number(process.env.REDIS_KEEPALIVE_MS ?? 30000),
          enableReadyCheck: true,
          retryStrategy(times) {
            const backoff = Math.min(2000, 100 * 2 ** times);
            return backoff;
          },
        });
      },
    },
    RedisService,
    ProductCacheService,
    SessionStoreService,
    QueueService,
    RateLimitService,
    OpsService,
    AdminApiKeyGuard,
    RedisRateLimitGuard,
    CdnCacheInterceptor,
    ProductCacheInvalidationInterceptor,
    Reflector,
  ],
  exports: [
    RedisService,
    ProductCacheService,
    SessionStoreService,
    QueueService,
    RateLimitService,
    OpsService,
    RedisRateLimitGuard,
    CdnCacheInterceptor,
    ProductCacheInvalidationInterceptor,
  ],
})
export class PerformanceModule {}
