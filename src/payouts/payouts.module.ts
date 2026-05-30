import { Module } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { PayoutReceiptService } from './payout-receipt.service';
import { PayoutsController } from './payouts.controller';
import { AdminPayoutsController } from './admin-payouts.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StellarModule } from '../stellar/stellar.module';
import { AdminGuard } from '../common/guards/admin.guard';

@Module({
  imports: [PrismaModule, StellarModule],
  controllers: [PayoutsController, AdminPayoutsController],
  providers: [PayoutsService, PayoutReceiptService, AdminGuard],
  exports: [PayoutsService],
})
export class PayoutsModule {}
