import { Injectable } from '@nestjs/common';
import { Currency } from './earnings.types';
import { EarningsAggregationService } from './earnings-aggregation.service';
import { EarningsExportService, EarningsExportOptions, EarningsExportResult } from './earnings-export.service';

export interface LeaderboardEntry {
  rank: number;
  label: string;
  totalEarned: number;
}

@Injectable()
export class EarningsService {
  constructor(
    private aggregationService: EarningsAggregationService,
    private exportService: EarningsExportService,
  ) {}

  public async invalidateUserEarningsCache(userId: number): Promise<void> {
    return this.aggregationService.invalidateUserEarningsCache(userId);
  }

  async getUserTotalEarnings(userId: number, targetCurrency: Currency = Currency.USD) {
    return this.aggregationService.getUserTotalEarnings(userId, targetCurrency);
  }

  async getEarningsByPeriod(
    userId: number,
    startDate: Date,
    endDate: Date,
    targetCurrency: Currency = Currency.USD,
  ) {
    return this.aggregationService.getEarningsByPeriod(userId, startDate, endDate, targetCurrency);
  }

  async getEarningsDashboard(
    userId: number,
    page = 1,
    limit = 20,
    targetCurrency: Currency = Currency.USD,
  ) {
    return this.aggregationService.getEarningsDashboard(userId, page, limit, targetCurrency);
  }

  async exportEarningsCsv(
    userId: number,
    options: EarningsExportOptions,
  ): Promise<EarningsExportResult> {
    return this.exportService.exportEarningsCsv(userId, options);
  }

  async softDelete(earningId: number, userId: number) {
    return this.aggregationService.softDelete(earningId, userId);
  }

  async getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
    return this.aggregationService.getLeaderboard(limit);
  }

  async getEarningsByPlatform(userId: number) {
    return this.aggregationService.getEarningsByPlatform(userId);
  }
}
