import { Module, Global } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsController } from './metrics.controller';

/**
 * MetricsModule
 *
 * Global module — MetricsService and MetricsInterceptor are available
 * everywhere without needing to import MetricsModule in every feature module.
 *
 * Provides:
 *   MetricsService    — counters, histograms, gauges, and summaries
 *   MetricsInterceptor — HTTP duration/throughput recording (registered globally in main.ts)
 *
 * Exposes:
 *   GET /metrics — Prometheus scrape endpoint (guarded by METRICS_TOKEN)
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, MetricsInterceptor],
  exports: [MetricsService, MetricsInterceptor],
})
export class MetricsModule {}
