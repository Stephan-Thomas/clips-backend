import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Req,
  Body,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PayoutsService } from './payouts.service';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: { userId: number };
}

@Controller('payouts')
@UseGuards(JwtAuthGuard)
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Post('request')
  async requestPayout(@Req() req: RequestWithUser) {
    return this.payoutsService.requestPayout(req.user.userId);
  }

  @Get()
  async getPayoutHistory(@Req() req: RequestWithUser) {
    return this.payoutsService.getPayoutHistory(req.user.userId);
  }

  @Post(':id/process')
  async processPayout(@Param('id') id: string) {
    return this.payoutsService.processPayout(parseInt(id, 10));
  }
}
