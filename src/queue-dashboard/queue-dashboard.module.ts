import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueDashboardController } from './queue-dashboard.controller';
import { QueueDashboardService } from './queue-dashboard.service';
import { JobFailureNotifierService } from './job-failure-notifier.service';
import { CLIP_GENERATION_QUEUE } from '../clips/clip-generation.queue';
import { CLIP_POSTING_QUEUE } from '../clips/clip-posting.queue';
import { PAYOUT_RETRY_QUEUE } from '../payouts/payout-retry.queue';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: CLIP_GENERATION_QUEUE },
      { name: CLIP_POSTING_QUEUE },
      { name: PAYOUT_RETRY_QUEUE },
    ),
    AuthModule,
    PrismaModule,
  ],
  controllers: [QueueDashboardController],
  providers: [QueueDashboardService, JobFailureNotifierService],
  exports: [QueueDashboardService],
})
export class QueueDashboardModule {}
