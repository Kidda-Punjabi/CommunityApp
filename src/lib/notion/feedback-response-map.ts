import {
  dateStart,
  plainTextFromRichText,
  plainTextFromTitle,
  selectName,
  statusName,
} from "@/lib/notion/client";
import { notionWinsTwoWay } from "@/lib/admin/delivery/metrics";

export type FeedbackResponseFields = {
  notionPageId: string;
  fullName: string | null;
  email: string | null;
  tutor: string | null;
  cohort: string | null;
  course: string | null;
  lesson: string | null;
  feedbackDate: string | null;
  learningRelevance: number | null;
  confidence: number | null;
  tutorEffectiveness: number | null;
  understanding: number | null;
  speaking: number | null;
  understandingGrammar: number | null;
  clarityStructure: number | null;
  conceptBreakdown: number | null;
  supportiveness: number | null;
  overallScore: number | null;
  videoTestimonial: string | null;
  videoTestimonialRecorded: string | null;
  actioned: string | null;
  criticalFeedback: boolean | null;
  comments: string | null;
  notes: string | null;
  notionLastEditedTime: string | null;
};

export type FeedbackResponseExisting = {
  actioned: string | null;
  video_testimonial_recorded: string | null;
  local_updated_at: string | null;
};

function numberValue(
  value: { number?: number | null; formula?: { number?: number | null } } | undefined
): number | null {
  if (typeof value?.number === "number" && Number.isFinite(value.number)) return value.number;
  if (typeof value?.formula?.number === "number" && Number.isFinite(value.formula.number)) {
    return value.formula.number;
  }
  return null;
}

function formulaBoolean(
  value: { formula?: { boolean?: boolean | null; type?: string } } | undefined
): boolean | null {
  if (typeof value?.formula?.boolean === "boolean") return value.formula.boolean;
  return null;
}

type NotionPageLike = {
  id: string;
  last_edited_time?: string;
  properties?: Record<string, unknown>;
};

export function parseNotionFeedbackPage(page: NotionPageLike): FeedbackResponseFields {
  const props = (page.properties ?? {}) as Record<string, Record<string, unknown>>;
  return {
    notionPageId: page.id,
    fullName: plainTextFromRichText(props["Full Name"] as { rich_text?: Array<{ plain_text?: string }> }),
    email: plainTextFromRichText(props.Email as { rich_text?: Array<{ plain_text?: string }> }),
    tutor: selectName(props.Tutor as { select?: { name?: string } | null }),
    cohort: selectName(props.Cohort as { select?: { name?: string } | null }),
    course: selectName(props.Course as { select?: { name?: string } | null }),
    lesson: selectName(props.Lesson as { select?: { name?: string } | null }),
    feedbackDate: dateStart(props["Feedback Date"] as { date?: { start?: string } | null }),
    learningRelevance: numberValue(props["Learning Relevance"] as { number?: number | null }),
    confidence: numberValue(props.Confidence as { number?: number | null }),
    tutorEffectiveness: numberValue(props["Tutor Effectiveness"] as { number?: number | null }),
    understanding: numberValue(props.Understanding as { number?: number | null }),
    speaking: numberValue(props.Speaking as { number?: number | null }),
    understandingGrammar: numberValue(props["Understanding Grammar"] as { number?: number | null }),
    clarityStructure: numberValue(props["Clarity & Structure"] as { number?: number | null }),
    conceptBreakdown: numberValue(props["Concept Breakdown"] as { number?: number | null }),
    supportiveness: numberValue(props.Supportiveness as { number?: number | null }),
    overallScore: numberValue(props["Overall Score"] as { number?: number | null }),
    videoTestimonial: selectName(
      props["Video Testimonial?"] as { select?: { name?: string } | null }
    ),
    videoTestimonialRecorded: statusName(
      props["Video Testimonial Recorded"] as { status?: { name?: string } | null }
    ),
    actioned: statusName(props.Actioned as { status?: { name?: string } | null }),
    criticalFeedback: formulaBoolean(props["Critical Feedback"] as { formula?: { boolean?: boolean } }),
    comments: plainTextFromRichText(props.Comments as { rich_text?: Array<{ plain_text?: string }> }),
    notes: plainTextFromTitle(props.Notes as { title?: Array<{ plain_text?: string }> }),
    notionLastEditedTime: page.last_edited_time ?? null,
  };
}

export function mergeFeedbackResponseRow(
  incoming: FeedbackResponseFields,
  existing: FeedbackResponseExisting | null
): {
  actioned: string | null;
  videoTestimonialRecorded: string | null;
  keepLocalTwoWay: boolean;
} {
  const notionWins = notionWinsTwoWay(
    incoming.notionLastEditedTime,
    existing?.local_updated_at
  );
  if (!existing || notionWins) {
    return {
      actioned: incoming.actioned,
      videoTestimonialRecorded: incoming.videoTestimonialRecorded,
      keepLocalTwoWay: false,
    };
  }
  return {
    actioned: existing.actioned,
    videoTestimonialRecorded: existing.video_testimonial_recorded,
    keepLocalTwoWay: true,
  };
}

export function isTestimonialPending(row: {
  lesson: string | null;
  videoTestimonial: string | null;
  videoTestimonialRecorded: string | null;
}): boolean {
  if (row.lesson !== "Lesson 12") return false;
  const wanted = (row.videoTestimonial ?? "").trim();
  if (wanted !== "Yes" && wanted !== "True") return false;
  const recorded = (row.videoTestimonialRecorded ?? "").trim();
  return !["Time Booked", "Live on Website", "Needs Editing", "Changed their mind"].includes(
    recorded
  );
}

export function isBelowParOverall(score: number | null, threshold: number): boolean {
  return score != null && Number.isFinite(score) && score < threshold;
}

export function isFeedbackToReview(row: {
  criticalFeedback: boolean | null;
  overallScore: number | null;
}, threshold: number): boolean {
  return Boolean(row.criticalFeedback) || isBelowParOverall(row.overallScore, threshold);
}
