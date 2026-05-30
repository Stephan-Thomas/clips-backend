import { Module } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { PayoutsController } from './payouts.controller';
import { PayoutLimitsService } from './payout-limits.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StellarModule } from '../stellar/stellar.module';

@Module({
  imports: [PrismaModule, StellarModule],
  controllers: [PayoutsController],
  providers: [PayoutsService, PayoutLimitsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
