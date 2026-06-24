import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RedisMemoryService, RedisMemoryStats } from './redis-memory.service';

interface HealthResponse {
  status: 'ok' | 'degraded';
  stats: RedisMemoryStats;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly redisMemoryService: RedisMemoryService) {}

  /**
   * Returns current Redis memory utilisation.
   * Responds with HTTP 200 when usage is within safe bounds and
   * HTTP 503 when usage exceeds the 80 % alert threshold.
   */
  @Get('redis-memory')
  @ApiOperation({
    summary: 'Redis memory health check',
    description:
      'Returns Redis memory stats. Status is "degraded" and HTTP 503 is returned when usage exceeds 80%.',
  })
  @ApiResponse({
    status: 200,
    description: 'Redis memory usage is within normal bounds.',
  })
  @ApiResponse({
    status: 503,
    description: 'Redis memory usage exceeds the 80% alert threshold.',
  })
  async checkRedisMemory(): Promise<HealthResponse> {
    let stats: RedisMemoryStats;
    try {
      stats = await this.redisMemoryService.getStats();
    } catch (err) {
      this.logger.error(
        `Redis memory health check threw unexpectedly: ${(err as Error).message}`,
      );
      // Surface as 503 so monitoring tools can detect and alert on it
      throw new HttpException(
        {
          status: 'degraded',
          alert: `Unable to retrieve Redis memory stats: ${(err as Error).message}`,
          unavailable: true,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Redis is unreachable — return 503 with a clear unavailable indicator
    if (stats.unavailable) {
      this.logger.warn('Redis memory health check: Redis unavailable');
      throw new HttpException(
        { status: 'degraded' as const, stats },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (stats.isAboveThreshold) {
      this.logger.warn('Redis memory health check returned degraded status', {
        usagePercent: stats.usagePercent,
        alert: stats.alert,
      });
      throw new HttpException(
        { status: 'degraded' as const, stats },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { status: 'ok', stats };
  }
}
