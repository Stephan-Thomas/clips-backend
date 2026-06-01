export interface EarningsBreakdown {
  royalties: number;
  subscriptions: number;
}

export interface UserTotalEarnings {
  total: number;
  breakdown: EarningsBreakdown;
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

export interface EarningsPeriodItem {
  id: number;
  amount: number;
  source: string | null;
  date: string;
  clipTitle: string | null;
}

export interface EarningsByPeriod {
  startDate: string;
  endDate: string;
  total: number;
  breakdown: EarningsBreakdown;
  items: EarningsPeriodItem[];
}
