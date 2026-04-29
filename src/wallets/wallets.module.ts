import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WalletsService } from './wallets.service';
import { WalletsController } from './wallets.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StellarModule } from '../stellar/stellar.module';

@Module({
  imports: [AuthModule, PrismaModule, StellarModule],
  providers: [WalletsService],
  controllers: [WalletsController],
})
export class WalletsModule {}
