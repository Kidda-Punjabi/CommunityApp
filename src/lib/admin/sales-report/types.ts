export const SALES_REPORT_PRESETS = [
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "custom",
] as const;

export type SalesReportPreset = (typeof SALES_REPORT_PRESETS)[number];

export type SalesReportRange = {
  preset: SalesReportPreset;
  startYmd: string;
  endYmd: string;
  previousStartYmd: string;
  previousEndYmd: string;
  mtdStartYmd: string;
  mtdEndYmd: string;
  label: string;
  previousLabel: string;
  mtdLabel: string;
};

export type ComparisonKind = "count" | "money" | "rate";

export type ComparedNumber = {
  current: number;
  previous: number | null;
  mtd: number | null;
  vsPreviousPct: number | null;
  vsPreviousPts: number | null;
  vsMtdPct: number | null;
  vsMtdPts: number | null;
  vsPreviousDirection: "up" | "down" | "flat";
  vsMtdDirection: "up" | "down" | "flat";
};

export type SalespersonRow = {
  name: string;
  callsBooked: number;
  callsTaken: number;
  callsClosed: number;
  closeRate: number | null;
  cashOnCallCount: number;
  cashOnCallPounds: number;
  paidAfterwardsCount: number;
  paidAfterwardsPounds: number;
  aovClosed: number | null;
  revenueCollected: number;
  revenueBooked: number;
  showRate: number | null;
  revenueRank: number;
  discountingFlag: boolean;
};

export type FunnelStageRow = {
  id: "leads" | "booked" | "showed" | "closed";
  name: string;
  count: number;
  dropOffFromPrevious: number | null;
};

export type FunnelBySourceRow = {
  source: string;
  bucket: "Paid ad" | "Organic" | "Referral" | "Other" | "Unknown";
  leads: number;
  booked: number;
  showed: number;
  closed: number;
};

export type ProductMixRow = {
  product: string;
  closedCount: number;
  revenueCollected: number;
  aov: number | null;
};

export type ProductBySalespersonRow = {
  salesperson: string;
  product: string;
  closedCount: number;
  revenueCollected: number;
  aov: number | null;
};

export type FollowUpRow = {
  salesperson: string;
  count: number;
};

export type AgingRow = {
  pageId: string;
  salesperson: string;
  outcome: string | null;
  lastEditedTime: string;
  daysSinceTouch: number;
  notes: string | null;
};

export type LostReasonRow = {
  reason: string;
  count: number;
};

export type DataQualityGap = {
  field: string;
  rowCount: number;
  note: string;
};

export type FinancingFlagRow = {
  pageId: string;
  salesperson: string;
  outstandingBalance: number;
  outBalStatus: string | null;
  paymentDate: string | null;
  collectedPounds: number;
};

export type SalesReportHeadline = {
  revenueCollected: ComparedNumber;
  revenueBooked: ComparedNumber;
  callsTaken: ComparedNumber;
  callsClosed: ComparedNumber;
  closeRate: ComparedNumber;
  leadsIn: ComparedNumber;
  callsBooked: ComparedNumber;
  bookingRate: ComparedNumber;
  showRate: ComparedNumber;
};

export type SalesReport = {
  range: SalesReportRange;
  generatedAt: string;
  agingDays: number;
  headline: SalesReportHeadline;
  salespeople: SalespersonRow[];
  teamTotals: SalespersonRow;
  funnel: FunnelStageRow[];
  funnelBySource: FunnelBySourceRow[];
  leadSourceUseful: boolean;
  leadSourceNote: string;
  products: ProductMixRow[];
  productBySalesperson: ProductBySalespersonRow[];
  productCatalogueNote: string;
  followUps: FollowUpRow[];
  aging: AgingRow[];
  lostReasons: LostReasonRow[];
  lostReasonNote: string;
  financingFlags: FinancingFlagRow[];
  dataQuality: {
    hasGaps: boolean;
    summary: string;
    gaps: DataQualityGap[];
  };
  diagnosis: string[];
  sourceStats: {
    salesCallPages: number;
    leadPages: number;
    fetchedAt: string;
  };
};

export type SalesCallRecord = {
  pageId: string;
  lastEditedTime: string;
  callDate: string | null;
  paymentDate: string | null;
  salespersonId: string | null;
  salespersonName: string | null;
  salespersonCount: number;
  outcome: string | null;
  showUp: boolean;
  closed: boolean;
  cashOnCall: number | null;
  paidAfterwards: number | null;
  outstandingBalance: number | null;
  outBalStatus: string | null;
  course: string | null;
  delivery: string | null;
  leadPageId: string | null;
  notes: string | null;
};

export type LeadRecord = {
  pageId: string;
  createdTime: string | null;
  createdYmd: string | null;
  leadSource: string | null;
  name: string | null;
};

export type SalesReportListItem = {
  id: string;
  rangePreset: SalesReportPreset;
  rangeStart: string;
  rangeEnd: string;
  rangeLabel: string;
  generatedAt: string;
  agingDays: number;
};
