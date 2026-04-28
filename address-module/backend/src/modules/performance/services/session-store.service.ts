import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_MAX_SESSIONS_PER_USER,
  DEFAULT_METRIC_TTL_SECONDS,
  DEFAULT_SESSION_TTL_SECONDS,
} from '../constants/performance.constants';
import { buildCacheKey } from '../utils/cache-key.util';
import { sha256 } from '../utils/hash.util';
import { RedisService } from './redis.service';

export interface SessionRecord {
  sessionId: string;
  userId: string;
  deviceId?: string;
  ip?: string;
  userAgent?: string;
  ipHash?: string;
  userAgentHash?: string;
  createdAt: string;
  lastSeenAt: string;
}

@Injectable()
export class SessionStoreService {
  constructor(private readonly redisService: RedisService) {}

  private async bumpMetric(metric: 'created' | 'revoked' | 'evicted') {
    const key = buildCacheKey('session:metric', { metric });
    try {
      await this.redisService.client.multi().incr(key).expire(key, DEFAULT_METRIC_TTL_SECONDS).exec();
    } catch {
      // Best-effort metrics.
    }
  }

  private shouldStoreRawMetadata() {
    return (process.env.STORE_RAW_SESSION_METADATA ?? 'false').toLowerCase() === 'true';
  }

  private async enforceSessionCap(userId: string, maxSessions = DEFAULT_MAX_SESSIONS_PER_USER) {
    if (!Number.isFinite(maxSessions) || maxSessions <= 0) {
      return;
    }

    const sessions = await this.listUserSessions(userId);
    if (sessions.length <= maxSessions) {
      return;
    }

    const sessionsToRevoke = sessions.slice(maxSessions);
    for (const session of sessionsToRevoke) {
      await this.revokeSession(session.sessionId);
      await this.bumpMetric('evicted');
    }
  }

  async createSession(
    userId: string,
    input: { deviceId?: string; ip?: string; userAgent?: string },
    ttlSeconds = DEFAULT_SESSION_TTL_SECONDS,
  ) {
    const sessionId = randomUUID();
    const now = new Date().toISOString();

    const record: SessionRecord = {
      sessionId,
      userId,
      deviceId: input.deviceId,
      ip: this.shouldStoreRawMetadata() ? input.ip : undefined,
      userAgent: this.shouldStoreRawMetadata() ? input.userAgent : undefined,
      ipHash: input.ip ? sha256(input.ip) : undefined,
      userAgentHash: input.userAgent ? sha256(input.userAgent) : undefined,
      createdAt: now,
      lastSeenAt: now,
    };

    const key = buildCacheKey('session', { sessionId });
    await this.redisService.client.set(key, JSON.stringify(record), 'EX', ttlSeconds);
    await this.redisService.client.sadd(buildCacheKey('session:user', { userId }), sessionId);
    await this.redisService.client.expire(buildCacheKey('session:user', { userId }), ttlSeconds);
    await this.enforceSessionCap(userId);
    await this.bumpMetric('created');

    return record;
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    const key = buildCacheKey('session', { sessionId });
    const raw = await this.redisService.client.get(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as SessionRecord;
  }

  async touchSession(sessionId: string, ttlSeconds = DEFAULT_SESSION_TTL_SECONDS): Promise<boolean> {
    const key = buildCacheKey('session', { sessionId });
    const raw = await this.redisService.client.get(key);
    if (!raw) {
      return false;
    }

    const current = JSON.parse(raw) as SessionRecord;
    current.lastSeenAt = new Date().toISOString();

    await this.redisService.client.set(key, JSON.stringify(current), 'EX', ttlSeconds);
    await this.redisService.client.expire(buildCacheKey('session:user', { userId: current.userId }), ttlSeconds);
    return true;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    const userSetKey = buildCacheKey('session:user', { userId });
    const sessionIds = await this.redisService.client.smembers(userSetKey);

    if (sessionIds.length === 0) {
      return [];
    }

    const keys = sessionIds.map((sessionId) => buildCacheKey('session', { sessionId }));
    const values = await this.redisService.client.mget(...keys);

    return values
      .filter((entry): entry is string => Boolean(entry))
      .map((entry) => JSON.parse(entry) as SessionRecord)
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  }

  async revokeSession(sessionId: string): Promise<void> {
    const key = buildCacheKey('session', { sessionId });
    const raw = await this.redisService.client.get(key);
    if (raw) {
      const session = JSON.parse(raw) as SessionRecord;
      await this.redisService.client.srem(buildCacheKey('session:user', { userId: session.userId }), sessionId);
    }

    await this.redisService.client.del(key);
    await this.bumpMetric('revoked');
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    const userSetKey = buildCacheKey('session:user', { userId });
    const sessionIds = await this.redisService.client.smembers(userSetKey);

    if (sessionIds.length === 0) {
      return 0;
    }

    const keys = sessionIds.map((sessionId) => buildCacheKey('session', { sessionId }));
    await this.redisService.client.del(...keys);
    await this.redisService.client.del(userSetKey);

    for (let i = 0; i < sessionIds.length; i += 1) {
      await this.bumpMetric('revoked');
    }

    return sessionIds.length;
  }

  async getSessionStats() {
    const [created, revoked, evicted] = await this.redisService.client.mget(
      buildCacheKey('session:metric', { metric: 'created' }),
      buildCacheKey('session:metric', { metric: 'revoked' }),
      buildCacheKey('session:metric', { metric: 'evicted' }),
    );

    return {
      created: Number(created ?? 0),
      revoked: Number(revoked ?? 0),
      evicted: Number(evicted ?? 0),
    };
  }
}
