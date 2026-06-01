import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

export interface EarningsBreakdown {
  royalties: number;
  subscriptions: number;
}

export interface EarningsHistoryItem {
  date: string;
  amount: number;
  source: string | null;
};

export interface LeaderboardEntry {
  rank: number;
  label: string;
  totalEarned: number;
}

@Injectable()
export class EarningsService {
  private readonly logger = new Logger(EarningsService.name);

  constructor(private prisma: PrismaService) {}

  async getUserTotalEarnings(userId: number): Promise<UserTotalEarnings> {
    const earnings = await this.prisma.$transaction((tx) =>
      tx.earning.findMany({
        where: this.userEarningsWhere(userId),
        select: { amount: true, source: true },
      }),
    );

    return this.aggregateEarnings(earnings);
  }

  async getEarningsByPeriod(
    userId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<EarningsByPeriod> {
    this.validatePeriod(startDate, endDate);

    const periodEnd = new Date(endDate);
    periodEnd.setUTCHours(23, 59, 59, 999);

    const earnings = await this.prisma.$transaction((tx) =>
      tx.earning.findMany({
        where: {
          ...this.userEarningsWhere(userId),
          date: { gte: startDate, lte: periodEnd },
        },
        select: {
          id: true,
          amount: true,
          source: true,
          date: true,
          clip: { select: { title: true } },
        },
        orderBy: { date: 'desc' },
      }),
    );

    const aggregated = this.aggregateEarnings(earnings);

    return {
      startDate: startDate.toISOString(),
      endDate: periodEnd.toISOString(),
      total: aggregated.total,
      breakdown: aggregated.breakdown,
      items: earnings.map((earning) => ({
        id: earning.id,
        amount: earning.amount,
        source: earning.source,
        date: earning.date.toISOString(),
        clipTitle: earning.clip.title,
      })),
    };
  }

  async getEarningsDashboard(
    userId: number,
    page = 1,
    limit = 20,
  ): Promise<EarningsDashboard> {
    const earnings = await this.prisma.earning.findMany({
      where: { clip: { video: { userId } }, deletedAt: null },
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

    const paidOut = snapshot.payouts
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingPayout = snapshot.payouts
      .filter((p) => p.status === 'pending' || p.status === 'processing')
      .reduce((sum, p) => sum + p.amount, 0);

    const historyItems: EarningsHistoryItem[] = [
      ...snapshot.earnings.map((e) => ({
        date: e.date.toISOString(),
        amount: e.amount,
        type: e.source as 'royalty' | 'subscription',
      })),
      ...snapshot.payouts.map((p) => ({
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
      totalEarned: totals.total,
      pendingPayout,
      paidOut,
      breakdown: totals.breakdown,
      history: paginatedHistory,
    };
  }

  async softDelete(earningId: number, userId: number): Promise<{ message: string }> {
    const earning = await this.prisma.earning.findUnique({
      where: { id: earningId },
      include: { clip: { include: { video: { select: { userId: true } } } } },
    });

    if (!earning || earning.clip.video.userId !== userId) {
      throw new NotFoundException(`Earning ${earningId} not found`);
    }

    if (earning.deletedAt !== null) {
      throw new NotFoundException(`Earning ${earningId} not found`);
    }

    await this.prisma.earning.update({
      where: { id: earningId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Soft-deleted earning ${earningId} for user ${userId}`);

    return { message: 'Earning deleted successfully' };
  }

  async getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
    const enabled = process.env.LEADERBOARD_ENABLED === 'true';
    if (!enabled) {
      return [];
    }

    const earnings = await this.prisma.earning.findMany({
      where: { deletedAt: null },
      select: {
        amount: true,
        clip: { select: { video: { select: { userId: true } } } },
      },
    });

    const totals = new Map<number, number>();
    for (const e of earnings) {
      const uid = e.clip.video.userId;
      totals.set(uid, (totals.get(uid) ?? 0) + e.amount);
    }

    const sorted = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    return sorted.map(([, total], index) => ({
      rank: index + 1,
      label: `Creator #${index + 1}`,
      totalEarned: total,
    }));
  }
}
