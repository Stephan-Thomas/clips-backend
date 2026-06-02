import { Module } from '@nestjs/common';
import { EarningsService } from './earnings.service';
import { EarningsAggregationService } from './earnings-aggregation.service';
import { EarningsExportService } from './earnings-export.service';
import { EarningsController } from './earnings.controller';
import { AdminAnomaliesController } from './admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { AnomalyDetectionProcessor } from './anomaly-detection.processor';
import { BullModule } from '@nestjs/bullmq';
import {
  ANOMALY_DETECTION_QUEUE,
  ANOMALY_DETECTION_QUEUE_PRIORITY,
} from './anomaly-detection.queue';
import { AuthModule } from '../auth/auth.module';
import { CurrencyConversionService } from './currency-conversion.service';
import { RedisModule } from '../redis/redis.module';
import { MonthlySummaryService } from './monthly-summary.service';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: ANOMALY_DETECTION_QUEUE,
      defaultJobOptions: { priority: ANOMALY_DETECTION_QUEUE_PRIORITY },
    }),
    AuthModule,
    RedisModule,
  ],
  controllers: [EarningsController, AdminAnomaliesController],
  providers: [
    EarningsService,
    EarningsAggregationService,
    EarningsExportService,
    AnomalyDetectionService,
    AnomalyDetectionProcessor,
    CurrencyConversionService,
    MonthlySummaryService,
  ],
  exports: [EarningsService, EarningsAggregationService, EarningsExportService, AnomalyDetectionService, CurrencyConversionService],
})
export class EarningsModule {}
