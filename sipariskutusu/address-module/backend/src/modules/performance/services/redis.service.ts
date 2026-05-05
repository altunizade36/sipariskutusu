import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../constants/performance.constants';

type ExecuteOptions = {
  timeoutMs?: number;
};

type RedisHealthSnapshot = {
  degraded: boolean;
  degradedUntil: number;
  lastErrorAt: number;
  lastErrorMessage: string;
};

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private degradedUntil = 0;
  private lastErrorAt = 0;
  private lastErrorMessage = '';

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  get client() {
    return this.redis;
  }

  private markDegraded(error: unknown) {
    const cooldownMs = Number(process.env.REDIS_DEGRADED_COOLDOWN_MS ?? 15_000);
    this.degradedUntil = Date.now() + cooldownMs;
    this.lastErrorAt = Date.now();
    this.lastErrorMessage = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Redis degraded for ${cooldownMs}ms: ${this.lastErrorMessage}`);
  }

  isDegraded() {
    return Date.now() < this.degradedUntil;
  }

  getHealthSnapshot(): RedisHealthSnapshot {
    return {
      degraded: this.isDegraded(),
      degradedUntil: this.degradedUntil,
      lastErrorAt: this.lastErrorAt,
      lastErrorMessage: this.lastErrorMessage,
    };
  }

  async execute<T>(operationName: string, operation: () => Promise<T>, options?: ExecuteOptions): Promise<T> {
    const timeoutMs = options?.timeoutMs ?? Number(process.env.REDIS_COMMAND_TIMEOUT_MS ?? 1200);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Redis operation timeout: ${operationName}`)), timeoutMs);
    });

    try {
      const result = await Promise.race([operation(), timeoutPromise]);
      return result as T;
    } catch (error) {
      this.markDegraded(error);
      throw error;
    }
  }

  async ping() {
    if (this.isDegraded()) {
      return {
        ok: false,
        pong: 'DEGRADED',
        ...this.getHealthSnapshot(),
      };
    }

    try {
      const pong = await this.execute('ping', () => this.redis.ping());
      return {
        ok: pong === 'PONG',
        pong,
        ...this.getHealthSnapshot(),
      };
    } catch {
      return {
        ok: false,
        pong: 'ERROR',
        ...this.getHealthSnapshot(),
      };
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
