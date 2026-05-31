import { Module } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { PayoutReceiptService } from './payout-receipt.service';
import { PayoutsController } from './payouts.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StellarModule } from '../stellar/stellar.module';

@Module({
  imports: [PrismaModule, StellarModule],
  controllers: [PayoutsController],
  providers: [PayoutsService, PayoutReceiptService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
