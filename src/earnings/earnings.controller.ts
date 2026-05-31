import {
  Controller,
  UseGuards,
  Get,
  Delete,
  Query,
  Param,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
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

  @Delete(':id')
  async deleteEarning(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.earningsService.softDelete(
      parseInt(id, 10),
      req.user.userId,
    );
  }

  @Public()
  @Get('leaderboard')
  async getLeaderboard(@Query('limit') limit = '10') {
    const limitNum = Math.min(parseInt(limit, 10) || 10, 100);
    return this.earningsService.getLeaderboard(limitNum);
  }
}
