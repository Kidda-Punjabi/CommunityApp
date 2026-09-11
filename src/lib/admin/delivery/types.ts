import type {
  DeliveryClassTypeId,
  DeliveryRangeId,
  DeliveryTutorName,
} from "@/lib/admin/delivery/constants";

export type DeliveryFiltersInput = {
  tutor: DeliveryTutorName | "all";
  rangeId: DeliveryRangeId;
  customFrom?: string;
  customTo?: string;
  classType: DeliveryClassTypeId | "all";
};

export type DeliveryRatingMetric = {
  current: number | null;
  previous: number | null;
  delta: number | null;
  sampleSize: number;
};

export type DeliveryChartPoint = {
  key: string;
  label: string;
  learningRelevance: number | null;
  confidence: number | null;
  tutorEffectiveness: number | null;
};

export type DeliveryClassTypeBreakdown = {
  classType: DeliveryClassTypeId;
  label: string;
  value: number | null;
  sampleSize: number;
};

export type DeliveryOpsMetric = {
  overall: number | null;
  sampleSize: number;
  byClassType: DeliveryClassTypeBreakdown[];
};

export type DeliveryAtRiskStudent = {
  userId: string;
  name: string;
  tutor: string | null;
  classType: DeliveryClassTypeId | null;
  classTypeLabel: string;
  cohortOrCourse: string;
  daysSinceLastActivity: number | null;
  detail: string;
};

export type DeliveryOffboardingRow = {
  userId: string;
  name: string;
  tutor: string | null;
  classType: DeliveryClassTypeId | null;
  classTypeLabel: string;
  packageRunName: string;
  statusLabel: string;
};

export type DeliveryTestimonialRow = {
  id: string;
  notionPageId: string;
  fullName: string;
  email: string | null;
  tutor: string | null;
  course: string | null;
  lesson: string | null;
  videoTestimonial: string | null;
  videoTestimonialRecorded: string | null;
  feedbackDate: string | null;
};

export type DeliveryReviewRow = {
  id: string;
  notionPageId: string;
  fullName: string;
  email: string | null;
  tutor: string | null;
  course: string | null;
  lesson: string | null;
  overallScore: number | null;
  learningRelevance: number | null;
  confidence: number | null;
  tutorEffectiveness: number | null;
  criticalFeedback: boolean;
  belowPar: boolean;
  actioned: string | null;
  comments: string | null;
  feedbackDate: string | null;
};

export type DeliveryTutorRow = {
  tutor: string;
  learningRelevance: number | null;
  confidence: number | null;
  tutorEffectiveness: number | null;
  attendancePercent: number | null;
  feedbackSample: number;
  attendanceSample: number;
};

export type DeliverySnapshot = {
  generatedAt: string;
  rangeLabel: string;
  rangeStart: string;
  rangeEnd: string;
  belowParThreshold: number;
  feedbackRowCount: number;
  ratings: {
    learningRelevance: DeliveryRatingMetric;
    confidence: DeliveryRatingMetric;
    tutorEffectiveness: DeliveryRatingMetric;
  };
  chart: DeliveryChartPoint[];
  homework: DeliveryOpsMetric;
  quiz: DeliveryOpsMetric;
  attendance: DeliveryOpsMetric;
  stoppedAttending: DeliveryAtRiskStudent[];
  noScheduledClasses: DeliveryAtRiskStudent[];
  pendingOffboarding: DeliveryOffboardingRow[];
  pendingOffboardingNote: string;
  testimonials: DeliveryTestimonialRow[];
  toReview: DeliveryReviewRow[];
  perTutor: DeliveryTutorRow[];
  teamAverage: DeliveryTutorRow;
  actionedStatuses: readonly string[];
  videoTestimonialRecordedStatuses: readonly string[];
  error?: string;
};

export const EMPTY_OPS_METRIC: DeliveryOpsMetric = {
  overall: null,
  sampleSize: 0,
  byClassType: [],
};
