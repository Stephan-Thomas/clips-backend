import { Controller, Get, Req, Res, Next } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Auth } from '../auth/decorators/auth.decorator';
import { QueueDashboardService } from './queue-dashboard.service';

@Controller('admin/queues')
@Auth('admin')
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
