export type AcquisitionRangeId = "7d" | "30d" | "quarter" | "custom";

export type MetricAvailability = "ok" | "empty" | "unavailable";

export type CountMetric = {
  availability: MetricAvailability;
  value: number | null;
  previous: number | null;
  reason?: string;
};

export type RateMetric = {
  availability: MetricAvailability;
  value: number | null;
  previous: number | null;
  numerator: number | null;
  denominator: number | null;
  reason?: string;
};

export type MoneyMetric = {
  availability: MetricAvailability;
  /** Pounds. */
  value: number | null;
  previous: number | null;
  reason?: string;
};

export type FunnelStage = {
  id: "leads" | "contacted" | "booked" | "showed" | "closed";
  name: string;
  availability: MetricAvailability;
  count: number | null;
  conversionFromPrevious: number | null;
  reason?: string;
};

export type AcquisitionSourceSync = {
  id: "notion" | "ghl" | "stripe" | "supabase";
  label: string;
  readAt: string | null;
  error?: string;
};

export type UpcomingCohortRow = {
  id: string;
  name: string;
  subtitle: string | null;
  startsAt: string | null;
  filled: number | null;
  capacity: number | null;
  daysLeft: number | null;
  status: "full" | "ontrack" | "atrisk" | "behind" | "unknown";
  statusLabel: string;
};

export type TimeToFillPoint = {
  label: string;
  days: number | null;
};

export type CashBreakdown = {
  groupPence: number;
  oneToOnePence: number;
  communityPence: number;
  otherPence: number;
};

export type NotionCashSplit = {
  availability: MetricAvailability;
  cashOnCallPence: number | null;
  paidAfterwardsPence: number | null;
  reason?: string;
};

export type CashDiscrepancyRow = {
  kind: "stripe_only" | "notion_only" | "amount_mismatch";
  email: string | null;
  name: string | null;
  stripePence: number | null;
  notionPence: number | null;
  salesCallId: string | null;
  note: string;
};

export type AcquisitionSnapshot = {
  rangeId: AcquisitionRangeId;
  rangeStart: string;
  rangeEnd: string;
  rangeLabel: string;
  generatedAt: string;
  kpis: {
    newLeads: CountMetric;
    callsBooked: CountMetric;
    showRate: RateMetric;
    closeRate: RateMetric;
    avgPackageValue: MoneyMetric;
  };
  funnel: FunnelStage[];
  velocity: {
    availability: MetricAvailability;
    poundsPerDay: number | null;
    opportunities: CountMetric;
    winRate: RateMetric;
    avgValue: MoneyMetric;
    cycleDays: CountMetric;
    reason?: string;
  };
  upcomingCohorts: UpcomingCohortRow[];
  timeToFill: TimeToFillPoint[];
  cash: {
    stripe: MoneyMetric;
    paymentCount: CountMetric;
    avgPayment: MoneyMetric;
    breakdown: CashBreakdown | null;
    notion: NotionCashSplit;
    stripePence: number | null;
    notionPence: number | null;
    discrepancy: CashDiscrepancyRow[];
  };
  sources: AcquisitionSourceSync[];
};
