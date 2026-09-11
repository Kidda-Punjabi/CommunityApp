"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import { loadDeliverySnapshot } from "@/lib/admin/delivery/load-delivery";
import type { DeliveryFiltersInput, DeliverySnapshot } from "@/lib/admin/delivery/types";
import { pullFeedbackResponsesFromNotion, pushFeedbackTwoWayField } from "@/lib/notion/feedback-response-sync";

export async function fetchDeliveryDashboard(
  filters: DeliveryFiltersInput
): Promise<DeliverySnapshot> {
  try {
    const supabase = await requireAdminFromActions();
    return loadDeliverySnapshot(supabase, filters);
  } catch (error) {
    return {
      generatedAt: new Date().toISOString(),
      rangeLabel: "",
      rangeStart: "",
      rangeEnd: "",
      belowParThreshold: 3.5,
      feedbackRowCount: 0,
      ratings: {
        learningRelevance: { current: null, previous: null, delta: null, sampleSize: 0 },
        confidence: { current: null, previous: null, delta: null, sampleSize: 0 },
        tutorEffectiveness: { current: null, previous: null, delta: null, sampleSize: 0 },
      },
      chart: [],
      homework: { overall: null, sampleSize: 0, byClassType: [] },
      quiz: { overall: null, sampleSize: 0, byClassType: [] },
      attendance: { overall: null, sampleSize: 0, byClassType: [] },
      stoppedAttending: [],
      noScheduledClasses: [],
      pendingOffboarding: [],
      pendingOffboardingNote: "",
      testimonials: [],
      toReview: [],
      perTutor: [],
      teamAverage: {
        tutor: "Team average",
        learningRelevance: null,
        confidence: null,
        tutorEffectiveness: null,
        attendancePercent: null,
        feedbackSample: 0,
        attendanceSample: 0,
      },
      actionedStatuses: [],
      videoTestimonialRecordedStatuses: [],
      error: error instanceof Error ? error.message : "Failed to load delivery dashboard.",
    };
  }
}

export async function syncFeedbackResponsesNow(): Promise<ActionResult & { upserted?: number }> {
  try {
    const supabase = await requireAdminFromActions();
    const result = await pullFeedbackResponsesFromNotion(supabase, { fullSync: true });
    if (result.errors.length > 0) {
      return { error: result.errors.join(" · "), upserted: result.upserted };
    }
    return { success: `Synced ${result.upserted} feedback row(s).`, upserted: result.upserted };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Feedback sync failed." };
  }
}

export async function updateFeedbackTwoWayField(input: {
  id: string;
  field: "actioned" | "video_testimonial_recorded";
  value: string;
}): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const { data: row, error: loadError } = await supabase
      .from("feedback_responses")
      .select("id, notion_page_id")
      .eq("id", input.id)
      .maybeSingle();
    if (loadError || !row?.notion_page_id) {
      return { error: loadError?.message ?? "Feedback row not found." };
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("feedback_responses")
      .update({
        [input.field]: input.value,
        local_updated_at: now,
      })
      .eq("id", input.id);
    if (updateError) return { error: updateError.message };

    const notionField =
      input.field === "actioned" ? "Actioned" : "Video Testimonial Recorded";
    const pushed = await pushFeedbackTwoWayField({
      pageId: row.notion_page_id as string,
      field: notionField,
      value: input.value,
    });

    await supabase
      .from("feedback_responses")
      .update({
        notion_last_edited_time: pushed.lastEditedTime,
        synced_at: now,
      })
      .eq("id", input.id);

    return { success: "Updated in the app and Notion." };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Saved locally but failed to update Notion.",
    };
  }
}
