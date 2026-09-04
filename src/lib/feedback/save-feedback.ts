import {
  buildNotionFeedbackProperties,
  createNotionFeedbackPage,
} from "@/lib/feedback/notion";
import type { FeedbackContext, FeedbackSubmitPayload } from "@/lib/feedback/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const COMMUNITY_FEEDBACK_ALREADY_SUBMITTED =
  "You've already submitted feedback for this class.";

export class FeedbackAlreadySubmittedError extends Error {
  constructor() {
    super(COMMUNITY_FEEDBACK_ALREADY_SUBMITTED);
    this.name = "FeedbackAlreadySubmittedError";
  }
}

function isDuplicateCommunitySessionError(error: { code?: string; message?: string }): boolean {
  if (error.code === "23505") {
    const message = (error.message ?? "").toLowerCase();
    return (
      message.includes("feedback_submissions_user_session_unique") ||
      (message.includes("session_id") && message.includes("user_id"))
    );
  }
  return false;
}

export async function saveFeedbackSubmission(
  supabase: SupabaseClient,
  userId: string | null,
  context: FeedbackContext,
  payload: FeedbackSubmitPayload,
  options?: { isGuest?: boolean }
): Promise<{
  submissionId: string;
  notionSynced: boolean;
  notionError?: string;
}> {
  const submittedAt = new Date();
  const isCommunity = payload.formVariant === "community";
  const sessionId = isCommunity ? (payload.sessionId ?? context.sessionId) : null;
  const lessonId = isCommunity ? null : context.lessonId;
  const isGuest = Boolean(options?.isGuest) || userId == null;

  if (isCommunity && !sessionId) {
    throw new Error("A class session is required.");
  }

  const { data: row, error: insertError } = await supabase
    .from("feedback_submissions")
    .insert({
      user_id: userId,
      is_guest: isGuest,
      lesson_id: lessonId,
      session_id: sessionId,
      form_variant: payload.formVariant,
      full_name: context.fullName,
      email: context.email,
      phone: context.phone,
      cohort: context.cohort,
      course: context.course,
      lesson_label: context.lessonLabel,
      tutor: context.tutor,
      tutor_unmatched: context.tutorUnmatched,
      learning_relevance: payload.formVariant === "week1" ? null : payload.learningRelevance,
      tutor_effectiveness: payload.formVariant === "week1" ? null : payload.tutorEffectiveness,
      confidence: payload.formVariant === "week1" ? null : payload.confidence,
      understanding: payload.understanding ?? null,
      speaking: payload.speaking ?? null,
      understanding_grammar: payload.understandingGrammar ?? null,
      clarity_structure: payload.clarityStructure ?? null,
      concept_breakdown: payload.conceptBreakdown ?? null,
      supportiveness: payload.supportiveness ?? null,
      overall_score: payload.overallScore ?? null,
      comments: payload.comments,
      testimonials: payload.testimonials ?? null,
      recommend: payload.recommend ?? null,
      video_testimonial: payload.videoTestimonial ?? null,
      future_support: payload.futureSupport ?? [],
      picture_url: payload.pictureUrl ?? null,
      notion_sync_status: "pending",
      submitted_at: submittedAt.toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !row) {
    if (insertError && isDuplicateCommunitySessionError(insertError)) {
      throw new FeedbackAlreadySubmittedError();
    }
    throw new Error(insertError?.message ?? "Failed to save feedback.");
  }

  try {
    const properties = buildNotionFeedbackProperties(context, payload, submittedAt);
    const { pageId } = await createNotionFeedbackPage(properties);

    await supabase
      .from("feedback_submissions")
      .update({
        notion_page_id: pageId,
        notion_sync_status: "synced",
        notion_synced_at: new Date().toISOString(),
        notion_sync_error: null,
      })
      .eq("id", row.id);

    return { submissionId: row.id, notionSynced: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notion sync failed.";
    await supabase
      .from("feedback_submissions")
      .update({
        notion_sync_status: "failed",
        notion_sync_error: message,
      })
      .eq("id", row.id);

    return {
      submissionId: row.id,
      notionSynced: false,
      notionError: message,
    };
  }
}
