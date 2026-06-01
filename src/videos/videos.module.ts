import { Module } from '@nestjs/common';
import { VideosController } from './videos.controller';
import { VideoUploadController } from './video-upload.controller';
import { ClipsModule } from '../clips/clips.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { VideoUploadService } from './video-upload.service';
import {
  CLIP_GENERATION_QUEUE,
  CLIP_GENERATION_QUEUE_PRIORITY,
} from '../clips/clip-generation.queue';

@Module({
  imports: [
    ClipsModule,
    PrismaModule,
    BullModule.registerQueue({
      name: CLIP_GENERATION_QUEUE,
      defaultJobOptions: { priority: CLIP_GENERATION_QUEUE_PRIORITY },
    }),
  ],
  controllers: [VideosController, VideoUploadController],
  providers: [VideoUploadService],
  exports: [VideoUploadService],
})
export class VideosModule {}
