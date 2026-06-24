import { Module } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { WalletsController } from './wallets.controller';
import { WalletOwnershipGuard } from './guards/wallet-ownership.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { StellarModule } from '../stellar/stellar.module';

@Module({
  imports: [PrismaModule, StellarModule],
  controllers: [WalletsController],
  providers: [WalletsService, WalletOwnershipGuard],
  exports: [WalletsService],
})
export class WalletsModule {}
