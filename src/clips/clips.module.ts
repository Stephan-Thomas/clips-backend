import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ClipsController } from './clips.controller';
import { ClipsService } from './clips.service';
import { ClipGenerationProcessor } from './clip-generation.processor';
import { CloudinaryService } from './cloudinary.service';
import { CLIP_GENERATION_QUEUE } from './clip-generation.queue';
import { NFT_MINT_QUEUE } from './nft-mint.queue';
import { NftMintProcessor } from './nft-mint.processor';
import { ClipsGateway } from './clips.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { NftMintService } from './nft-mint.service';
import { StellarModule } from '../stellar/stellar.module';
import { CircuitBreakerModule } from '../common/circuit-breaker/circuit-breaker.module';
import { AyrshareService } from './ayrshare.service';
import { ClipPublishService } from './clip-publish.service';
import { RedisModule } from '../redis/redis.module';
import { QueueRateLimitGuard } from '../common/guards/queue-rate-limit.guard';

@Module({
  imports: [
    BullModule.registerQueue({ name: CLIP_GENERATION_QUEUE }),
    BullModule.registerQueue({ name: NFT_MINT_QUEUE }),
    PrismaModule,
    StellarModule,
    CircuitBreakerModule,
    RedisModule,
  ],
  controllers: [ClipsController],
  providers: [
    ClipsService,
    ClipGenerationProcessor,
    NftMintProcessor,
    CloudinaryService,
    ClipsGateway,
    NftMintService,
    AyrshareService,
    ClipPublishService,
    QueueRateLimitGuard,
  ],
  exports: [ClipsService, CloudinaryService, ClipsGateway, NftMintService, ClipPublishService],
})
export class ClipsModule {}
