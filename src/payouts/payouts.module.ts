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
import { AdminPayoutsController } from './admin.controller';
import { AdminFeesController } from './fees.controller';
import { FeeService } from './fee.service';
import { PayoutMethodService } from './payout-method.service';
import { PayoutMethodController } from './payout-method.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StellarModule } from '../stellar/stellar.module';
import { AuthModule } from '../auth/auth.module';
import { EncryptionModule } from '../encryption/encryption.module';

@Module({
  imports: [PrismaModule, StellarModule, AuthModule, EncryptionModule],
  controllers: [
    PayoutsController,
    AdminPayoutsController,
    AdminFeesController,
    PayoutMethodController,
  ],
  providers: [
    PayoutsService,
    PayoutReceiptService,
    FeeService,
    PayoutMethodService,
  ],
  exports: [PayoutsService, FeeService, PayoutMethodService],
})
export class PayoutsModule {}
