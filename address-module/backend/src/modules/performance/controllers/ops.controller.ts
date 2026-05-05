import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AdminApiKeyGuard } from '../guards/admin-api-key.guard';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { RedisRateLimitGuard } from '../guards/redis-rate-limit.guard';
import { OpsService } from '../services/ops.service';
import { QueueService } from '../services/queue.service';

@Controller('ops')
@UseGuards(AdminApiKeyGuard)
export class OpsController {
  constructor(
    private readonly opsService: OpsService,
    private readonly queueService: QueueService,
  ) {}

  @Get('live')
  live() {
    return this.opsService.getLiveness();
  }

  @Get('ready')
  async ready() {
    return this.opsService.getReadiness();
  }

  @Get('security')
  security() {
    return this.opsService.getSecurityPosture();
  }

  @Get('config')
  config() {
    return this.opsService.getRuntimeConfigSummary();
  }

  @Get('overview')
  async overview() {
    return this.opsService.getOperationsOverview();
  }

  @Get('queues/:queue/stats')
  async queueStats(@Param('queue') queue: string) {
    return this.queueService.getQueueStats(queue);
  }

  @Post('queues/:queue/promote')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({ maxRequests: 30, windowSeconds: 60, keyPrefix: 'rate-limit:ops-queue-promote' })
  async promoteQueue(
    @Param('queue') queue: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.queueService.promoteScheduled(queue, limit);
  }

  @Post('queues/:queue/enqueue')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({ maxRequests: 60, windowSeconds: 60, keyPrefix: 'rate-limit:ops-queue-enqueue' })
  async enqueue(
    @Param('queue') queue: string,
    @Body() body: { payload?: Record<string, unknown>; delaySeconds?: number; maxAttempts?: number; dedupeKey?: string },
  ) {
    return this.queueService.enqueue(queue, body.payload ?? {}, {
      delaySeconds: body.delaySeconds,
      maxAttempts: body.maxAttempts,
      dedupeKey: body.dedupeKey,
    });
  }
}
