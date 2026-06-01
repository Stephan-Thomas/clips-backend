export const PAYOUT_FILTER_STATUSES = [
  'pending',
  'completed',
  'failed',
] as const;

export type PayoutFilterStatus = (typeof PAYOUT_FILTER_STATUSES)[number];
