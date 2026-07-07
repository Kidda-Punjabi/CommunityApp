import type {
  FeedbackFormVariant,
  FutureSupportOption,
  NotionCourseOption,
} from "./constants";

export type FeedbackContext = {
  fullName: string;
  email: string;
  phone: string | null;
  cohort: string;
  course: NotionCourseOption;
  lessonLabel: string;
  lessonNumber: number | null;
  /** Preferred or display name shown on the form. */
  tutor: string | null;
  /** Canonical name sent to the Notion Tutor select field. */
  notionTutor: string | null;
  tutorUnmatched: boolean;
  lessonId: string | null;
  formVariant: FeedbackFormVariant;
};

export type FeedbackSubmitPayload = {
  formVariant: FeedbackFormVariant;
  lessonId?: string | null;
  learningRelevance: number;
  tutorEffectiveness: number;
  confidence: number;
  understanding?: number;
  speaking?: number;
  understandingGrammar?: number;
  clarityStructure?: number;
  conceptBreakdown?: number;
  supportiveness?: number;
  overallScore?: number;
  comments: string;
  testimonials?: string | null;
  recommend?: "Yes" | "No";
  videoTestimonial?: "Yes" | "No";
  futureSupport?: FutureSupportOption[];
};

export type FeedbackSubmitResult = {
  ok: true;
  submissionId: string;
  notionSynced: boolean;
  notionError?: string;
};
