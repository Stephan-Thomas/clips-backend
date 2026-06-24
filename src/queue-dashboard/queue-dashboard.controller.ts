import { Controller, Get, Req, Res, Next, Query } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { Auth } from '../auth/decorators/auth.decorator';
import { QueueDashboardService } from './queue-dashboard.service';
import { QueueCollectorService } from '../metrics/queue-collector.service';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('queues')
@ApiBearerAuth('access-token')
@Controller('admin/queues')
@Auth('admin')
export class QueueDashboardController {
  constructor(
    private readonly queueDashboardService: QueueDashboardService,
    private readonly queueCollectorService: QueueCollectorService,
  ) {}

  @Get('*')
  dashboard(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    const router = this.queueDashboardService.getRouter();
    return router(req, res, next);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get queue statistics', description: 'Get active, waiting, and failed jobs per queue' })
  @ApiQuery({ name: 'queue', required: false, description: 'Specific queue name (optional)', type: String })
  async getQueueStats(@Query('queue') queue?: string) {
    return this.queueCollectorService.getQueueStats(queue);
  }
}
