"use server";

import { requireMasterAdminContext } from "@/app/admin/tutor-hours/actions";
import {
  loadAdminTutorHoursReview,
  type TutorHoursReviewResult,
} from "@/lib/admin/load-admin-tutor-hours-review";
import { KIDDA_WORK_CATEGORIES, type KiddaWorkCategory } from "@/lib/calendar/event-tags";
import type { ReviewCategory } from "@/lib/admin/suggest-calendar-category";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ReviewConfirmItem = {
  sessionId: string;
  category: ReviewCategory;
  scope: "event" | "series";
};

export type ReviewConfirmResult = {
  error?: string;
  tagged: number;
  excluded: number;
  flagged: Array<{ title: string; tutorId: string; sessionId: string }>;
};

export async function fetchAdminTutorHoursReview(
  weekStart?: string | null
): Promise<TutorHoursReviewResult> {
  try {
    const { supabase } = await requireMasterAdminContext();
    return await loadAdminTutorHoursReview(supabase, weekStart);
  } catch (e) {
    return {
      weekStart: weekStart ?? "",
      tutors: [],
      error: e instanceof Error ? e.message : "Failed to load review list.",
    };
  }
}

async function deleteMatchingExclusions(
  adminClient: SupabaseClient,
  tutorId: string,
  googleEventId: string | null,
  googleRecurringEventId: string | null
) {
  if (googleEventId) {
    await adminClient
      .from("tutor_calendar_event_exclusions")
      .delete()
      .eq("tutor_id", tutorId)
      .eq("google_event_id", googleEventId);
  }
  if (googleRecurringEventId) {
    await adminClient
      .from("tutor_calendar_event_exclusions")
      .delete()
      .eq("tutor_id", tutorId)
      .eq("google_recurring_event_id", googleRecurringEventId);
  }
}

async function deleteMatchingTags(
  adminClient: SupabaseClient,
  tutorId: string,
  googleEventId: string | null,
  googleRecurringEventId: string | null
) {
  if (googleEventId) {
    await adminClient
      .from("tutor_calendar_event_tags")
      .delete()
      .eq("tutor_id", tutorId)
      .eq("google_event_id", googleEventId);
  }
  if (googleRecurringEventId) {
    await adminClient
      .from("tutor_calendar_event_tags")
      .delete()
      .eq("tutor_id", tutorId)
      .eq("google_recurring_event_id", googleRecurringEventId);
  }
}

export async function confirmTutorHoursReviewItems(
  items: ReviewConfirmItem[]
): Promise<ReviewConfirmResult> {
  const flagged: ReviewConfirmResult["flagged"] = [];
  try {
    const { supabase, userId } = await requireMasterAdminContext();
    let tagged = 0;
    let excluded = 0;

    for (const item of items) {
      if (item.category === "lesson_needs_matching") {
        const { data: session } = await supabase
          .from("tutor_scheduled_sessions")
          .select("id, tutor_id, title")
          .eq("id", item.sessionId)
          .maybeSingle();
        if (session) {
          flagged.push({
            title: session.title,
            tutorId: session.tutor_id,
            sessionId: session.id,
          });
        }
        continue;
      }

      const { data: session, error: sessionError } = await supabase
        .from("tutor_scheduled_sessions")
        .select("id, tutor_id, title, google_event_id, google_recurring_event_id, match_method")
        .eq("id", item.sessionId)
        .maybeSingle();

      if (sessionError || !session) {
        return { error: "Event not found.", tagged, excluded, flagged };
      }
      if (session.match_method !== "unmatched") {
        continue;
      }

      const scope: "event" | "series" =
        item.scope === "series" && session.google_recurring_event_id ? "series" : "event";
      const googleEventId = scope === "series" ? null : session.google_event_id;
      const googleRecurringEventId =
        scope === "series" ? session.google_recurring_event_id : null;

      if (item.category === "personal") {
        await deleteMatchingTags(
          supabase,
          session.tutor_id,
          googleEventId ?? session.google_event_id,
          googleRecurringEventId ?? session.google_recurring_event_id
        );
        if (scope === "series" && session.google_recurring_event_id) {
          await supabase
            .from("tutor_calendar_event_exclusions")
            .delete()
            .eq("tutor_id", session.tutor_id)
            .eq("google_recurring_event_id", session.google_recurring_event_id);
          const { error } = await supabase.from("tutor_calendar_event_exclusions").insert({
            tutor_id: session.tutor_id,
            google_recurring_event_id: session.google_recurring_event_id,
            google_event_id: null,
            title: session.title,
            scope: "series",
          });
          if (error) return { error: error.message, tagged, excluded, flagged };
        } else {
          await supabase
            .from("tutor_calendar_event_exclusions")
            .delete()
            .eq("tutor_id", session.tutor_id)
            .eq("google_event_id", session.google_event_id);
          const { error } = await supabase.from("tutor_calendar_event_exclusions").insert({
            tutor_id: session.tutor_id,
            google_event_id: session.google_event_id,
            google_recurring_event_id: null,
            title: session.title,
            scope: "event",
          });
          if (error) return { error: error.message, tagged, excluded, flagged };
        }
        excluded += 1;
        continue;
      }

      if (!KIDDA_WORK_CATEGORIES.includes(item.category as KiddaWorkCategory)) {
        return { error: "Unknown category.", tagged, excluded, flagged };
      }

      await deleteMatchingExclusions(
        supabase,
        session.tutor_id,
        googleEventId ?? session.google_event_id,
        googleRecurringEventId ?? session.google_recurring_event_id
      );
      await deleteMatchingTags(
        supabase,
        session.tutor_id,
        googleEventId ?? session.google_event_id,
        googleRecurringEventId ?? session.google_recurring_event_id
      );

      const { error } = await supabase.from("tutor_calendar_event_tags").insert({
        tutor_id: session.tutor_id,
        google_event_id: googleEventId,
        google_recurring_event_id: googleRecurringEventId,
        title: session.title,
        scope,
        category: item.category,
        tagged_by: userId,
      });
      if (error) {
        return { error: error.message, tagged, excluded, flagged };
      }
      tagged += 1;
    }

    revalidatePath("/admin/tutor-hours");
    revalidatePath("/admin/tutor-hours/review");
    revalidatePath("/dashboard/tutor/calendar");
    return { tagged, excluded, flagged };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to confirm.",
      tagged: 0,
      excluded: 0,
      flagged,
    };
  }
}
