import { Module } from '@nestjs/common';
import { EarningsService } from './earnings.service';
import { EarningsController } from './earnings.controller';
import { AdminAnomaliesController } from './admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { AnomalyDetectionProcessor } from './anomaly-detection.processor';
import { BullModule } from '@nestjs/bullmq';
import { ANOMALY_DETECTION_QUEUE } from './anomaly-detection.queue';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: ANOMALY_DETECTION_QUEUE,
      defaultJobOptions: { priority: ANOMALY_DETECTION_QUEUE_PRIORITY },
    }),
    AuthModule,
  ],
  controllers: [EarningsController, AdminAnomaliesController],
  providers: [
    EarningsService,
    AnomalyDetectionService,
    AnomalyDetectionProcessor,
  ],
  exports: [EarningsService, AnomalyDetectionService],
})
export class EarningsModule {}
