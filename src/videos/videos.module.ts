import { Module } from '@nestjs/common';
import { VideosController } from './videos.controller';
import { VideoUploadController } from './video-upload.controller';
import { ClipsModule } from '../clips/clips.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { VideoUploadService } from './video-upload.service';
import { CLIP_GENERATION_QUEUE } from '../clips/clip-generation.queue';

@Module({
  imports: [
    ClipsModule,
    PrismaModule,
    BullModule.registerQueue({
      name: CLIP_GENERATION_QUEUE,
    }),
  ],
  controllers: [VideosController, VideoUploadController],
  providers: [VideoUploadService],
  exports: [VideoUploadService],
})
export class VideosModule {}
