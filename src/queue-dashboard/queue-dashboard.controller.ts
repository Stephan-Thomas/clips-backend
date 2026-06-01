import { Controller, Get, Req, Res, UseGuards, Next } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { QueueDashboardService } from './queue-dashboard.service';

@Controller('admin/queues')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class QueueDashboardController {
  constructor(private readonly queueDashboardService: QueueDashboardService) {}

  @Get('*')
  dashboard(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    const router = this.queueDashboardService.getRouter();
    return router(req, res, next);
  }
}
