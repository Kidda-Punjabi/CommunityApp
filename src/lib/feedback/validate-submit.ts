import {
  FUTURE_SUPPORT_OPTIONS,
  STANDARD_RATING_FIELDS,
  WEEK12_EXTRA_RATING_FIELDS,
  type FutureSupportOption,
} from "./constants";
import type { FeedbackSubmitPayload } from "./types";
import { parseRating, parseYesNo, validateFutureSupport } from "./notion";
import { isAllowedFeedbackPhotoUrl } from "./photo-url";

export function parseFeedbackSubmitBody(
  body: unknown
): { ok: true; payload: FeedbackSubmitPayload } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }

  const raw = body as Record<string, unknown>;
  const formVariant =
    raw.formVariant === "week12"
      ? "week12"
      : raw.formVariant === "community"
        ? "community"
        : raw.formVariant === "week1"
          ? "week1"
          : "standard";

  const lessonId =
    typeof raw.lessonId === "string" && raw.lessonId.trim() ? raw.lessonId.trim() : null;
  const sessionId =
    typeof raw.sessionId === "string" && raw.sessionId.trim() ? raw.sessionId.trim() : null;

  const comments = typeof raw.comments === "string" ? raw.comments.trim() : "";

  if (formVariant === "week1") {
    const understanding = parseRating(raw.understanding);
    const speaking = parseRating(raw.speaking);
    if (understanding === null || speaking === null) {
      return {
        ok: false,
        error: "Understanding spoken Punjabi and basic speaking must be rated from 1 to 5.",
      };
    }

    let understandingGrammar: number | undefined;
    if (raw.understandingGrammar != null && raw.understandingGrammar !== "") {
      const parsedGrammar = parseRating(raw.understandingGrammar);
      if (parsedGrammar === null) {
        return {
          ok: false,
          error: "Understanding grammar must be a rating from 1 to 5.",
        };
      }
      understandingGrammar = parsedGrammar;
    }

    return {
      ok: true,
      payload: {
        formVariant: "week1",
        lessonId,
        understanding,
        speaking,
        understandingGrammar,
        comments,
      },
    };
  }

  const standardRatings: Partial<Record<string, number>> = {};
  for (const field of STANDARD_RATING_FIELDS) {
    const value = parseRating(raw[field.key]);
    if (value === null) {
      return { ok: false, error: `${field.label} must be a rating from 1 to 5.` };
    }
    standardRatings[field.key] = value;
  }

  if (formVariant === "community") {
    if (!sessionId) {
      return { ok: false, error: "A class session is required." };
    }
    return {
      ok: true,
      payload: {
        formVariant: "community",
        lessonId: null,
        sessionId,
        learningRelevance: standardRatings.learningRelevance!,
        tutorEffectiveness: standardRatings.tutorEffectiveness!,
        confidence: standardRatings.confidence!,
        comments,
      },
    };
  }

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

  let pictureUrl: string | null = null;
  if (typeof raw.pictureUrl === "string" && raw.pictureUrl.trim()) {
    const trimmed = raw.pictureUrl.trim();
    if (!isAllowedFeedbackPhotoUrl(trimmed)) {
      return { ok: false, error: "Photo URL is not valid." };
    }
    pictureUrl = trimmed;
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
      pictureUrl,
    },
  };
}

export { FUTURE_SUPPORT_OPTIONS, STANDARD_RATING_FIELDS, WEEK12_EXTRA_RATING_FIELDS };
