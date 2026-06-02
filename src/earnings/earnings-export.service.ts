import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildEarningsCsv } from './earnings-csv.util';

export interface EarningsExportOptions {
  startDate?: string;
  endDate?: string;
}

export interface EarningsExportResult {
  filename: string;
  content: string;
}

@Injectable()
export class EarningsExportService {
  private readonly logger = new Logger(EarningsExportService.name);

  constructor(private prisma: PrismaService) {}

  private userEarningsWhere(userId: number) {
    return {
      clip: { video: { userId } },
      deletedAt: null,
    };
  }

  async exportEarningsCsv(
    userId: number,
    options: EarningsExportOptions,
  ): Promise<EarningsExportResult> {
    let where = this.userEarningsWhere(userId);
    if (options.startDate || options.endDate) {
      where = { ...where, date: {} };
      if (options.startDate) {
        where.date.gte = new Date(options.startDate);
      }
      if (options.endDate) {
        const end = new Date(options.endDate);
        end.setUTCHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    const earnings = await this.prisma.earning.findMany({
      where,
      select: {
        date: true,
        amount: true,
        currency: true,
        source: true,
        clip: { select: { title: true } },
      },
      orderBy: { date: 'desc' },
    });

    const rows = earnings.map((e) => [
      e.date.toISOString(),
      e.clip?.title,
      e.amount,
      e.currency,
      e.source,
      '',
    ]);

    const content = buildEarningsCsv(rows);
    const filename = `earnings-export-${new Date().toISOString().split('T')[0]}.csv`;

    this.logger.log(`Exported ${earnings.length} earnings records for user ${userId}`);

    return { filename, content };
  }
}
