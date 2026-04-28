import {
  Controller,
  UseGuards,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EarningsService } from './earnings.service';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: { userId: number };
}

@UseGuards(JwtAuthGuard)
@Controller('earnings')
export class EarningsController {
  constructor(private readonly earningsService: EarningsService) {}

  @Get()
  async getEarnings(
    @Req() req: RequestWithUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    return this.earningsService.getEarningsDashboard(
      req.user.userId,
      pageNum,
      limitNum,
    );
  }
}
