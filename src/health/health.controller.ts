import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
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
        `Redis memory health check failed: ${(err as Error).message}`,
      );
      throw new InternalServerErrorException(
        'Unable to retrieve Redis memory stats',
      );
    }

    if (stats.isAboveThreshold) {
      this.logger.warn('Redis memory health check returned degraded status', {
        usagePercent: stats.usagePercent,
        alert: stats.alert,
      });

      // Return 503 so load balancers / monitoring tools can act on it
      const response = {
        status: 'degraded' as const,
        stats,
      };

      // Return 503 so load balancers / monitoring tools can act on it.
      // Throwing HttpException preserves the full JSON body in the response.
      throw new HttpException(response, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return { status: 'ok', stats };
  }
}
