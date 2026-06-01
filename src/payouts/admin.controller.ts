import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Admin } from '../auth/decorators/admin.decorator';
import { PayoutsService } from './payouts.service';

interface BatchApproveDto {
  payoutIds: number[];
}

@Controller('admin/payouts')
@UseGuards(JwtAuthGuard)
@Admin()
export class AdminPayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Post('batch-approve')
  @HttpCode(HttpStatus.OK)
  async batchApprove(@Body() body: BatchApproveDto) {
    return this.payoutsService.batchProcessPayouts(body.payoutIds);
  }
}
