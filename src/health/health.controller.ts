import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { CLIP_GENERATION_QUEUE } from '../clips/clip-generation.queue';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly redisService: RedisService,
    @InjectQueue(CLIP_GENERATION_QUEUE) private readonly clipQueue: Queue,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Infrastructure health check' })
  @ApiResponse({ status: 200, description: 'Health status of API, Redis, and queue' })
  async check() {
    const redisOk = await this.redisService.ping();

    const [waiting, active, failed] = await Promise.all([
      this.clipQueue.getWaitingCount().catch(() => -1),
      this.clipQueue.getActiveCount().catch(() => -1),
      this.clipQueue.getFailedCount().catch(() => -1),
    ]);

    return {
      api: 'ok',
      redis: redisOk ? 'ok' : 'error',
      queue: {
        name: CLIP_GENERATION_QUEUE,
        waiting,
        active,
        failed,
      },
    };
  }
}
