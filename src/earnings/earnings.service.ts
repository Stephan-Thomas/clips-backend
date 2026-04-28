import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface EarningsBreakdown {
  royalties: number;
  subscriptions: number;
}

export interface EarningsHistoryItem {
  date: string;
  amount: number;
  type: 'royalty' | 'subscription' | 'payout';
}

export interface EarningsDashboard {
  totalEarned: number;
  pendingPayout: number;
  paidOut: number;
  breakdown: EarningsBreakdown;
  history: EarningsHistoryItem[];
}

@Injectable()
export class EarningsService {
  private readonly logger = new Logger(EarningsService.name);

  constructor(private prisma: PrismaService) {}

  async getEarningsDashboard(
    userId: number,
    page = 1,
    limit = 20,
  ): Promise<EarningsDashboard> {
    const earnings = await this.prisma.earning.findMany({
      where: { clip: { video: { userId } } },
      select: { amount: true, source: true, date: true },
    });

    const royalties = earnings
      .filter((e) => e.source === 'royalty')
      .reduce((sum, e) => sum + e.amount, 0);

    const subscriptions = earnings
      .filter((e) => e.source === 'subscription')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalEarned = royalties + subscriptions;

    const payouts = await this.prisma.payout.findMany({
      where: { userId },
      select: { amount: true, status: true, createdAt: true },
    });

    const paidOut = payouts
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingPayout = payouts
      .filter((p) => p.status === 'pending' || p.status === 'processing')
      .reduce((sum, p) => sum + p.amount, 0);

    const historyItems: EarningsHistoryItem[] = [
      ...earnings.map((e) => ({
        date: e.date.toISOString(),
        amount: e.amount,
        type: e.source as 'royalty' | 'subscription',
      })),
      ...payouts.map((p) => ({
        date: p.createdAt.toISOString(),
        amount: p.amount,
        type: 'payout' as const,
      })),
    ];

    historyItems.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const start = (page - 1) * limit;
    const paginatedHistory = historyItems.slice(start, start + limit);

    return {
      totalEarned,
      pendingPayout,
      paidOut,
      breakdown: {
        royalties,
        subscriptions,
      },
      history: paginatedHistory,
    };
  }
}
