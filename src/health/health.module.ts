import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HealthController } from './health.controller';
import { RedisModule } from '../redis/redis.module';
import { CLIP_GENERATION_QUEUE } from '../clips/clip-generation.queue';

@Module({
  imports: [
    RedisModule,
    BullModule.registerQueue({ name: CLIP_GENERATION_QUEUE }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
