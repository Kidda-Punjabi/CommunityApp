import {
  FUTURE_SUPPORT_OPTIONS,
  STANDARD_RATING_FIELDS,
  WEEK12_EXTRA_RATING_FIELDS,
  type FutureSupportOption,
} from "./constants";
import type { FeedbackSubmitPayload } from "./types";
import { parseRating, parseYesNo, validateFutureSupport } from "./notion";

export function parseFeedbackSubmitBody(
  body: unknown
): { ok: true; payload: FeedbackSubmitPayload } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }

  const raw = body as Record<string, unknown>;
  const formVariant = raw.formVariant === "week12" ? "week12" : "standard";

  const standardRatings: Partial<Record<string, number>> = {};
  for (const field of STANDARD_RATING_FIELDS) {
    const value = parseRating(raw[field.key]);
    if (value === null) {
      return { ok: false, error: `${field.label} must be a rating from 1 to 5.` };
    }
    standardRatings[field.key] = value;
  }

  const lessonId =
    typeof raw.lessonId === "string" && raw.lessonId.trim() ? raw.lessonId.trim() : null;

  const comments = typeof raw.comments === "string" ? raw.comments.trim() : "";

  if (formVariant === "standard") {
    return {
      ok: true,
      payload: {
        formVariant: "standard",
        lessonId,
        learningRelevance: standardRatings.learningRelevance!,
        tutorEffectiveness: standardRatings.tutorEffectiveness!,
        confidence: standardRatings.confidence!,
        comments,
      },
    };
  }

  const week12Ratings: Partial<Record<string, number>> = {};
  for (const field of WEEK12_EXTRA_RATING_FIELDS) {
    const value = parseRating(raw[field.key]);
    if (value === null) {
      return { ok: false, error: `${field.label} must be a rating from 1 to 5.` };
    }
    week12Ratings[field.key] = value;
  }

  const recommend = parseYesNo(raw.recommend);
  const videoTestimonial = parseYesNo(raw.videoTestimonial);
  if (!recommend || !videoTestimonial) {
    return {
      ok: false,
      error: "Recommend and video testimonial must be Yes or No.",
    };
  }

  const futureSupportRaw = Array.isArray(raw.futureSupport)
    ? raw.futureSupport.map(String)
    : [];
  if (!validateFutureSupport(futureSupportRaw)) {
    return { ok: false, error: "Future support contains invalid options." };
  }

  const includeTestimonial = raw.includeTestimonial === true;
  const testimonials =
    includeTestimonial && typeof raw.testimonials === "string"
      ? raw.testimonials.trim()
      : null;

  if (includeTestimonial && !testimonials) {
    return {
      ok: false,
      error: "Please add your testimonial text or turn off the testimonial option.",
    };
  }

  return {
    ok: true,
    payload: {
      formVariant: "week12",
      lessonId,
      learningRelevance: standardRatings.learningRelevance!,
      tutorEffectiveness: standardRatings.tutorEffectiveness!,
      confidence: standardRatings.confidence!,
      understanding: week12Ratings.understanding!,
      speaking: week12Ratings.speaking!,
      understandingGrammar: week12Ratings.understandingGrammar!,
      clarityStructure: week12Ratings.clarityStructure!,
      conceptBreakdown: week12Ratings.conceptBreakdown!,
      supportiveness: week12Ratings.supportiveness!,
      overallScore: week12Ratings.overallScore!,
      comments,
      testimonials,
      recommend,
      videoTestimonial,
      futureSupport: futureSupportRaw as FutureSupportOption[],
    },
  };
}

export { FUTURE_SUPPORT_OPTIONS, STANDARD_RATING_FIELDS, WEEK12_EXTRA_RATING_FIELDS };
