import { Module } from '@nestjs/common';
import { NftConfig } from './nft.config';
import { NftService } from './nft.service';
import { NftController } from './nft.controller';
import { RoyaltyQueryService } from './royalty-query.service';
import { PlatformRevenueService } from './platform-revenue.service';
import { PlatformRevenueController } from './platform-revenue.controller';
import { BatchRoyaltyService } from './batch-royalty.service';
import { BatchRoyaltyController } from './batch-royalty.controller';
import { NftMintService } from '../clips/nft-mint.service';
import { NftOwnershipService } from './nft-ownership.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StellarModule } from '../stellar/stellar.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, StellarModule, RedisModule],
  providers: [
    NftConfig,
    NftService,
    NftMintService,
    RoyaltyQueryService,
    NftOwnershipService,
    PlatformRevenueService,
    BatchRoyaltyService,
  ],
  controllers: [
    NftController,
    PlatformRevenueController,
    BatchRoyaltyController,
  ],
  exports: [
    NftService,
    NftMintService,
    RoyaltyQueryService,
    NftOwnershipService,
    PlatformRevenueService,
    BatchRoyaltyService,
  ],
})
export class NftModule {}
