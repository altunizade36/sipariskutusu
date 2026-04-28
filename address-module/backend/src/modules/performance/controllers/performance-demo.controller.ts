import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { CdnCache } from '../decorators/cdn-cache.decorator';
import { InvalidateProductCache } from '../decorators/invalidate-product-cache.decorator';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { RedisRateLimitGuard } from '../guards/redis-rate-limit.guard';
import { CdnCacheInterceptor } from '../interceptors/cdn-cache.interceptor';
import { ProductCacheInvalidationInterceptor } from '../interceptors/product-cache-invalidation.interceptor';
import { ProductCacheService } from '../services/product-cache.service';
import { RateLimitService } from '../services/rate-limit.service';
import { RedisService } from '../services/redis.service';
import { SessionStoreService } from '../services/session-store.service';

@Controller('performance')
export class PerformanceDemoController {
  constructor(
    private readonly productCacheService: ProductCacheService,
    private readonly rateLimitService: RateLimitService,
    private readonly sessionStoreService: SessionStoreService,
    private readonly redisService: RedisService,
  ) {}

  @Get('health/redis')
  async redisHealth() {
    return this.redisService.ping();
  }

  @Get('metrics/cache')
  async cacheMetrics() {
    return this.productCacheService.getCacheStats();
  }

  @Get('metrics/rate-limit')
  async rateLimitMetrics() {
    return this.rateLimitService.getRateLimitStats();
  }

  @Get('metrics/sessions')
  async sessionMetrics() {
    return this.sessionStoreService.getSessionStats();
  }

  @Get('metrics/overview')
  async metricsOverview() {
    const [redis, cache, rateLimit, sessions] = await Promise.all([
      this.redisService.ping(),
      this.productCacheService.getCacheStats(),
      this.rateLimitService.getRateLimitStats(),
      this.sessionStoreService.getSessionStats(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      redis,
      cache,
      rateLimit,
      sessions,
    };
  }

  @Get('products/:id')
  @UseInterceptors(CdnCacheInterceptor)
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({ maxRequests: 180, windowSeconds: 60, keyPrefix: 'rate-limit:product-detail' })
  @CdnCache({ isPublic: true, maxAge: 10, sMaxAge: 120, staleWhileRevalidate: 60, staleIfError: 600 })
  async getProduct(@Param('id') id: string) {
    return this.productCacheService.getOrSetProductById(id, async () => {
      return {
        id,
        title: `Demo Product ${id}`,
        price: 199.9,
        currency: 'TRY',
        source: 'origin',
      };
    });
  }

  @Post('products/search')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({ maxRequests: 120, windowSeconds: 60, keyPrefix: 'rate-limit:product-search' })
  @CdnCache({ isPublic: true, maxAge: 5, sMaxAge: 60, staleWhileRevalidate: 30, staleIfError: 300 })
  async searchProducts(@Body() query: Record<string, unknown>) {
    return this.productCacheService.getOrSetProductSearch(query, async () => {
      return {
        items: [],
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        source: 'origin',
      };
    });
  }

  @Post('products/:id/invalidate-cache')
  async invalidateProductCache(@Param('id') id: string) {
    await this.productCacheService.invalidateProduct(id);
    return { invalidated: true, productId: id };
  }

  @Post('products/:id/mock-update')
  @UseInterceptors(ProductCacheInvalidationInterceptor)
  @InvalidateProductCache({ paramKey: 'id' })
  async mockUpdateProduct(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    // Simulates a successful product mutation and triggers cache invalidation interceptor.
    return {
      updated: true,
      productId: id,
      payload: body,
    };
  }

  @Post('sessions/create')
  async createSession(@Body() body: { userId: string; deviceId?: string; ip?: string; userAgent?: string }) {
    return this.sessionStoreService.createSession(body.userId, {
      deviceId: body.deviceId,
      ip: body.ip,
      userAgent: body.userAgent,
    });
  }

  @Get('sessions/:sessionId')
  async getSession(@Param('sessionId') sessionId: string) {
    return this.sessionStoreService.getSession(sessionId);
  }

  @Get('sessions/user/:userId')
  async listUserSessions(@Param('userId') userId: string) {
    return this.sessionStoreService.listUserSessions(userId);
  }

  @Post('sessions/:sessionId/touch')
  async touchSession(@Param('sessionId') sessionId: string) {
    return {
      touched: await this.sessionStoreService.touchSession(sessionId),
    };
  }

  @Post('sessions/:sessionId/revoke')
  async revokeSession(@Param('sessionId') sessionId: string) {
    await this.sessionStoreService.revokeSession(sessionId);
    return { revoked: true };
  }
}
