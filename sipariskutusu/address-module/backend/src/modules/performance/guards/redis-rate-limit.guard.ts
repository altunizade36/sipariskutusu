import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  DEFAULT_RATE_LIMIT_BAN_CANARY_PERCENT,
  DEFAULT_LOCAL_EMERGENCY_LIMIT_MAP_MAX,
  DEFAULT_RATE_LIMIT_BAN_SECONDS,
  DEFAULT_RATE_LIMIT_BAN_THRESHOLD,
  RATE_LIMIT_FAIL_OPEN,
  RATE_LIMIT_OPTIONS,
} from '../constants/performance.constants';
import type { RateLimitOptions } from '../interfaces/cache-options.interface';
import { RateLimitService } from '../services/rate-limit.service';
import { RedisService } from '../services/redis.service';

@Injectable()
export class RedisRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RedisRateLimitGuard.name);
  private readonly localWindowMs = 60_000;
  private readonly localCounters = new Map<string, number[]>();
  private readonly localMapMax = DEFAULT_LOCAL_EMERGENCY_LIMIT_MAP_MAX;

  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
    private readonly redisService: RedisService,
  ) {}

  private checkLocalEmergencyLimit(identifier: string, maxRequests: number) {
    const now = Date.now();
    const windowStart = now - this.localWindowMs;

    if (this.localCounters.size > this.localMapMax) {
      const firstKey = this.localCounters.keys().next().value as string | undefined;
      if (firstKey) {
        this.localCounters.delete(firstKey);
      }
    }

    const existing = this.localCounters.get(identifier) ?? [];
    const pruned = existing.filter((ts) => ts > windowStart);
    pruned.push(now);
    this.localCounters.set(identifier, pruned);

    return {
      allowed: pruned.length <= maxRequests,
      remaining: Math.max(0, maxRequests - pruned.length),
      retryAfterSeconds: Math.ceil(this.localWindowMs / 1000),
      resetAtUnixMs: now + this.localWindowMs,
    };
  }

  private shouldApplyBanCanary(identifier: string) {
    const canaryPercent = Math.max(0, Math.min(100, DEFAULT_RATE_LIMIT_BAN_CANARY_PERCENT));
    if (canaryPercent >= 100) {
      return true;
    }
    if (canaryPercent <= 0) {
      return false;
    }

    let hash = 0;
    for (let i = 0; i < identifier.length; i += 1) {
      hash = (hash * 31 + identifier.charCodeAt(i)) >>> 0;
    }

    const bucket = hash % 100;
    return bucket < canaryPercent;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const options =
      this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_OPTIONS, [
        context.getHandler(),
        context.getClass(),
      ]) ?? {
        maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120),
        windowSeconds: Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60),
      };

    const userId = req.user?.id as string | undefined;
    const sourceIp =
      (req.headers['cf-connecting-ip'] as string | undefined) ||
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';

    const routeScopeEnabled = (process.env.RATE_LIMIT_SCOPE_BY_ROUTE ?? 'true').toLowerCase() === 'true';
    const routeScope = routeScopeEnabled ? `${req.method}:${req.route?.path ?? req.path ?? 'unknown'}` : 'global';
    const identifier = userId ? `uid:${userId}:${routeScope}` : `ip:${sourceIp}:${routeScope}`;

    const banKey = `rate-limit:ban:${identifier}`;
    const strikeKey = `rate-limit:strike:${identifier}`;
    const banSeconds = DEFAULT_RATE_LIMIT_BAN_SECONDS;
    const strikeThreshold = DEFAULT_RATE_LIMIT_BAN_THRESHOLD;
    const canBan = this.shouldApplyBanCanary(identifier);

    const isBanned = await this.redisService
      .execute('rate-limit-ban-check', () => this.redisService.client.exists(banKey))
      .then((value) => Number(value) > 0)
      .catch(() => false);

    if (isBanned) {
      void this.rateLimitService.recordBanEvent('blocked');
      res.setHeader('Retry-After', String(banSeconds));
      res.setHeader('X-RateLimit-Ban-Canary', canBan ? 'active' : 'inactive');
      throw new HttpException(
        {
          message: 'Temporarily blocked due to repeated rate-limit abuse',
          retryAfterSeconds: banSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const decision = await this.rateLimitService.checkLimit(identifier, options).catch((error: unknown) => {
      if (RATE_LIMIT_FAIL_OPEN) {
        void this.rateLimitService.recordFallback('fail_open');
        this.logger.warn(`Rate limit backend unavailable; fail-open enabled. identifier=${identifier} error=${error instanceof Error ? error.message : String(error)}`);
        return {
          allowed: true,
          maxRequests: options.maxRequests,
          remaining: options.maxRequests,
          resetAtUnixMs: Date.now() + options.windowSeconds * 1000,
          retryAfterSeconds: 0,
        };
      }

      const emergencyMax = Math.max(10, Math.floor(options.maxRequests * 0.4));
      const emergency = this.checkLocalEmergencyLimit(identifier, emergencyMax);
      void this.rateLimitService.recordFallback('emergency');
      this.logger.warn(`Rate limit backend unavailable; local emergency limiter engaged. identifier=${identifier} allowed=${emergency.allowed}`);

      return {
        allowed: emergency.allowed,
        maxRequests: emergencyMax,
        remaining: emergency.remaining,
        resetAtUnixMs: emergency.resetAtUnixMs,
        retryAfterSeconds: emergency.retryAfterSeconds,
      };
    });

    res.setHeader('X-RateLimit-Limit', String(decision.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(decision.remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.floor(decision.resetAtUnixMs / 1000)));

    if (decision.allowed) {
      return true;
    }

    res.setHeader('X-RateLimit-Ban-Canary', canBan ? 'active' : 'inactive');

    if (!canBan) {
      res.setHeader('Retry-After', String(decision.retryAfterSeconds));
      throw new HttpException(
        {
          message: 'Rate limit exceeded',
          retryAfterSeconds: decision.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    void this.redisService
      .execute('rate-limit-strike-increment', () =>
        this.redisService.client
          .multi()
          .incr(strikeKey)
          .expire(strikeKey, options.windowSeconds * 5)
          .exec(),
      )
      .then(async () => {
        const strikeRaw = await this.redisService.execute('rate-limit-strike-read', () => this.redisService.client.get(strikeKey));
        const strikeCount = Number(strikeRaw ?? 0);
        if (strikeCount >= strikeThreshold) {
          await this.redisService.execute('rate-limit-ban-set', () => this.redisService.client.set(banKey, '1', 'EX', banSeconds));
          await this.rateLimitService.recordBanEvent('triggered');
        }
      })
      .catch(() => {
        // Best-effort abuse tracking.
      });

    res.setHeader('Retry-After', String(decision.retryAfterSeconds));
    throw new HttpException(
      {
        message: 'Rate limit exceeded',
        retryAfterSeconds: decision.retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
