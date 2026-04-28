import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_METRIC_TTL_SECONDS,
  DEFAULT_QUEUE_MAX_PROMOTION_BATCH,
  DEFAULT_QUEUE_MESSAGE_RETENTION_SECONDS,
} from '../constants/performance.constants';
import { buildCacheKey } from '../utils/cache-key.util';
import { RedisService } from './redis.service';

type EnqueueJobOptions = {
  delaySeconds?: number;
  maxAttempts?: number;
  dedupeKey?: string;
};

type QueueJob<TPayload = Record<string, unknown>> = {
  id: string;
  queue: string;
  payload: TPayload;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  availableAt: string;
};

@Injectable()
export class QueueService {
  constructor(private readonly redisService: RedisService) {}

  private queueKey(queue: string) {
    return buildCacheKey('queue:jobs', { queue });
  }

  private scheduledKey(queue: string) {
    return buildCacheKey('queue:scheduled', { queue });
  }

  private deadLetterKey(queue: string) {
    return buildCacheKey('queue:dead-letter', { queue });
  }

  private metricKey(queue: string, metric: string) {
    return buildCacheKey('queue:metric', { queue, metric });
  }

  private dedupeKey(queue: string, dedupeKey: string) {
    return buildCacheKey('queue:dedupe', { queue, dedupeKey });
  }

  private async bumpMetric(queue: string, metric: 'enqueued' | 'scheduled' | 'promoted' | 'deduped') {
    const key = this.metricKey(queue, metric);
    try {
      await this.redisService.client.multi().incr(key).expire(key, DEFAULT_METRIC_TTL_SECONDS).exec();
    } catch {
      // Queue metrics are best-effort.
    }
  }

  async enqueue<TPayload extends Record<string, unknown>>(
    queue: string,
    payload: TPayload,
    options?: EnqueueJobOptions,
  ) {
    const delaySeconds = Math.max(0, Number(options?.delaySeconds ?? 0));
    const maxAttempts = Math.max(1, Number(options?.maxAttempts ?? 5));
    const createdAt = new Date();
    const availableAt = new Date(createdAt.getTime() + delaySeconds * 1000);
    const job: QueueJob<TPayload> = {
      id: randomUUID(),
      queue,
      payload,
      attempts: 0,
      maxAttempts,
      createdAt: createdAt.toISOString(),
      availableAt: availableAt.toISOString(),
    };

    if (options?.dedupeKey) {
      const acquired = await this.redisService.client.set(
        this.dedupeKey(queue, options.dedupeKey),
        job.id,
        'EX',
        DEFAULT_QUEUE_MESSAGE_RETENTION_SECONDS,
        'NX',
      );

      if (acquired !== 'OK') {
        await this.bumpMetric(queue, 'deduped');
        return {
          accepted: false,
          reason: 'duplicate',
        } as const;
      }
    }

    const serializedJob = JSON.stringify(job);
    if (delaySeconds > 0) {
      await this.redisService.client.zadd(this.scheduledKey(queue), availableAt.getTime(), serializedJob);
      await this.redisService.client.expire(this.scheduledKey(queue), DEFAULT_QUEUE_MESSAGE_RETENTION_SECONDS);
      await this.bumpMetric(queue, 'scheduled');
    } else {
      await this.redisService.client.rpush(this.queueKey(queue), serializedJob);
      await this.redisService.client.expire(this.queueKey(queue), DEFAULT_QUEUE_MESSAGE_RETENTION_SECONDS);
      await this.bumpMetric(queue, 'enqueued');
    }

    return {
      accepted: true,
      queue,
      jobId: job.id,
      availableAt: job.availableAt,
      delayed: delaySeconds > 0,
    } as const;
  }

  async promoteScheduled(queue: string, limit = DEFAULT_QUEUE_MAX_PROMOTION_BATCH) {
    const now = Date.now();
    const scheduledKey = this.scheduledKey(queue);
    const readyJobs = await this.redisService.client.zrangebyscore(scheduledKey, 0, now, 'LIMIT', 0, limit);

    if (readyJobs.length === 0) {
      return { queue, promoted: 0 };
    }

    const pipeline = this.redisService.client.multi();
    for (const job of readyJobs) {
      pipeline.rpush(this.queueKey(queue), job);
      pipeline.zrem(scheduledKey, job);
    }

    await pipeline.exec();
    await this.bumpMetric(queue, 'promoted');

    return {
      queue,
      promoted: readyJobs.length,
    };
  }

  async getQueueStats(queue: string) {
    const [ready, scheduled, deadLetter, enqueued, promoted, deduped] = await this.redisService.client.mget(
      this.queueKey(queue),
      this.scheduledKey(queue),
      this.deadLetterKey(queue),
      this.metricKey(queue, 'enqueued'),
      this.metricKey(queue, 'promoted'),
      this.metricKey(queue, 'deduped'),
    );

    const [readyDepth, scheduledDepth, deadLetterDepth] = await Promise.all([
      this.redisService.client.llen(this.queueKey(queue)),
      this.redisService.client.zcard(this.scheduledKey(queue)),
      this.redisService.client.llen(this.deadLetterKey(queue)),
    ]);

    return {
      queue,
      readyDepth,
      scheduledDepth,
      deadLetterDepth,
      metrics: {
        enqueued: Number(enqueued ?? 0),
        promoted: Number(promoted ?? 0),
        deduped: Number(deduped ?? 0),
      },
      keys: {
        ready: typeof ready === 'string' ? this.queueKey(queue) : this.queueKey(queue),
        scheduled: typeof scheduled === 'string' ? this.scheduledKey(queue) : this.scheduledKey(queue),
        deadLetter: typeof deadLetter === 'string' ? this.deadLetterKey(queue) : this.deadLetterKey(queue),
      },
    };
  }
}