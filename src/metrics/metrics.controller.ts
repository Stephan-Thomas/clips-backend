import { Controller, Get, Headers, UnauthorizedException, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

/**
 * MetricsController
 *
 * Exposes the Prometheus /metrics scrape endpoint.
 * Protected by a static bearer token (METRICS_TOKEN env var) to prevent
 * public exposure of internal system data.
 *
 * Usage:
 *   curl -H "x-metrics-token: <METRICS_TOKEN>" http://localhost:3000/metrics
 */
@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiOperation({
    summary: 'Prometheus metrics scrape endpoint',
    description:
      'Returns all Prometheus metrics in text format. ' +
      'Requires the `x-metrics-token` header to match the `METRICS_TOKEN` environment variable.',
  })
  @ApiResponse({ status: 200, description: 'Metrics in Prometheus text format' })
  @ApiResponse({ status: 401, description: 'Invalid or missing metrics token' })
  async getMetrics(
    @Headers('x-metrics-token') token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const expected = process.env.METRICS_TOKEN;

    if (!expected || !token || token !== expected) {
      throw new UnauthorizedException('Invalid or missing metrics token');
    }

    const registry = this.metricsService.getRegistry();
    const content = await registry.metrics();

    res.set('Content-Type', registry.contentType);
    res.send(content);
  }
}
