export type CeoArea = "acquisition" | "operations" | "delivery";

export type CeoFormat = "currency" | "percent" | "ratio" | "number" | "score" | "months";

export type CeoDirection = "min" | "max";

export type CeoStatus =
  | "not_connected"
  | "needs_target"
  | "on_target"
  | "watch"
  | "off_target";

export type CeoMetric = {
  id: string;
  label: string;
  area: CeoArea;
  format: CeoFormat;
  direction: CeoDirection;
  sortOrder: number;
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  target: number | null;
  status: CeoStatus;
  detail: string;
};

export type CeoActions = {
  stripeMissing: number;
  callsNoOutcome: number;
  cohortsNotFull: number;
  deliveryFollowUps: number;
};

export type CeoSnapshot = {
  snapshotDate: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  metrics: CeoMetric[];
  actions: CeoActions;
};

export type CeoCall = {
  id: string;
  leadId: string | null;
  callDate: string | null;
  outcome: string | null;
  showUp: boolean;
  closed: boolean;
};

export type CeoPayment = {
  id: string;
  amountPence: number;
  email: string | null;
  name: string | null;
  receivedAt?: string | null;
};

export type CeoCohort = {
  id: string;
  name: string;
  startDate: string | null;
  capacity: number | null;
  confirmed: number | null;
  status: string | null;
};

export type CeoTarget = {
  id: string;
  label: string;
  area: CeoArea;
  format: CeoFormat;
  direction: CeoDirection;
  target: number | null;
  sortOrder: number;
};

export type CeoInputs = {
  periodStart: string;
  periodEnd: string;
  leadsCreated: number | null;
  stripeConnected: boolean;
  calls: CeoCall[];
  stripePayments: CeoPayment[];
  notionPayments: CeoPayment[];
  adSpend: number | null;
  cohortsStarted: CeoCohort[];
  recruitingCohorts: CeoCohort[];
  attendanceRate: number | null;
  homeworkRate: number | null;
  quizHighScoreRate: number | null;
  quizSample: number;
  tutorEffectiveness: number | null;
  learningRelevance: number | null;
  confidence: number | null;
  feedbackSample: number;
  deliveryFollowUps: number;
  vatRegisteredFrom: string;
  pricesIncludeVat: boolean;
  targets: CeoTarget[];
};
