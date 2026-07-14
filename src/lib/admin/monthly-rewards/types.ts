export const MONTHLY_GIFT_AMOUNTS = {
  1: 25,
  2: 20,
  3: 15,
} as const;

export type MonthlyRewardRank = 1 | 2 | 3;
export type MonthlyRewardStatus = "pending" | "sent";

export type MonthlyWinnerPreview = {
  userId: string;
  displayName: string;
  pointsTotal: number;
  rank: MonthlyRewardRank;
  giftCardAmount: number;
};

export type MonthlyRewardWinnerRow = {
  id: string;
  monthStart: string;
  userId: string;
  displayName: string;
  rank: MonthlyRewardRank;
  pointsTotal: number;
  giftCardAmount: number;
  status: MonthlyRewardStatus;
  giftReference: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type MonthlyRewardsAttention = {
  pendingMonths: Array<{
    monthStart: string;
    monthLabel: string;
    pendingCount: number;
  }>;
  /** Most recent completed month with no saved winners yet. */
  uncalculatedMonth: {
    monthStart: string;
    monthLabel: string;
  } | null;
};
