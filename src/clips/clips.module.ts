import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ClipsController } from './clips.controller';
import { ClipsService } from './clips.service';
import { ClipGenerationProcessor } from './clip-generation.processor';
import { CloudinaryService } from './cloudinary.service';
import { NftMintProcessor } from './nft-mint.processor';
import { ClipPostingProcessor } from './clip-posting.processor';
import { ClipsGateway } from './clips.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { NftMintService } from './nft-mint.service';
import { StellarModule } from '../stellar/stellar.module';
import { CircuitBreakerModule } from '../common/circuit-breaker/circuit-breaker.module';
import { AyrshareService } from './ayrshare.service';
import { ClipPublishService } from './clip-publish.service';
import { RedisModule } from '../redis/redis.module';
import { QueueRateLimitGuard } from '../common/guards/queue-rate-limit.guard';
import { UserPlatformModule } from '../user-platform/user-platform.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    QueueModule,
    PrismaModule,
    StellarModule,
    CircuitBreakerModule,
    RedisModule,
    UserPlatformModule,
    // JwtModule used by ClipsGateway to verify WebSocket handshake tokens
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev_jwt_secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [ClipsController],
  providers: [
    ClipsService,
    // Heavy video-processing worker (concurrency: 1 — default)
    ClipGenerationProcessor,
    NftMintProcessor,
    // Lightweight posting worker (concurrency: 10 — set in @Processor decorator)
    ClipPostingProcessor,
    CloudinaryService,
    ClipsGateway,
    NftMintService,
    AyrshareService,
    ClipPublishService,
    QueueRateLimitGuard,
  ],
  exports: [
    ClipsService,
    CloudinaryService,
    ClipsGateway,
    NftMintService,
    ClipPublishService,
  ],
})
export class ClipsModule {}
