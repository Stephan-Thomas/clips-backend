import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ClipsController } from './clips.controller';
import { ClipsService } from './clips.service';
import { ClipGenerationProcessor } from './clip-generation.processor';
import { CloudinaryService } from './cloudinary.service';
import { CLIP_GENERATION_QUEUE } from './clip-generation.queue';
import { ClipsGateway } from './clips.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { NftMintService } from './nft-mint.service';
import { StellarModule } from '../stellar/stellar.module';
import { AyrshareService } from './ayrshare.service';
import { ClipPublishService } from './clip-publish.service';
import { UserPlatformModule } from '../user-platform/user-platform.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: CLIP_GENERATION_QUEUE }),
    PrismaModule,
    StellarModule,
    UserPlatformModule,
  ],
  controllers: [ClipsController],
  providers: [
    ClipsService,
    ClipGenerationProcessor,
    CloudinaryService,
    ClipsGateway,
    NftMintService,
    AyrshareService,
    ClipPublishService,
  ],
  exports: [ClipsService, CloudinaryService, ClipsGateway, NftMintService, ClipPublishService],
})
export class ClipsModule {}
