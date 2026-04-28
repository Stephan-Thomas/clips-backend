import { Module } from '@nestjs/common';
import { EarningsService } from './earnings.service';
import { EarningsController } from './earnings.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EarningsController],
  providers: [EarningsService],
  exports: [EarningsService],
})
export class EarningsModule {}
