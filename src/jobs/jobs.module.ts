import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { QueueCleanupService } from './queue-cleanup.service';
import { CLIP_GENERATION_QUEUE } from '../clips/clip-generation.queue';

@Module({
  imports: [
    BullModule.registerQueue({
      name: CLIP_GENERATION_QUEUE,
      defaultJobOptions: { priority: CLIP_GENERATION_QUEUE_PRIORITY },
    }),
  ],
  controllers: [JobsController],
  providers: [JobsService, QueueCleanupService],
})
export class JobsModule {}
