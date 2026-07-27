"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import {
  loadAdminRescheduleRequests,
  loadAlternativeSlotsForTutor,
} from "@/lib/admin/load-admin-reschedule-requests";
import { applyRescheduleSlotToSession } from "@/lib/calendar/tutor-cover";
import { revalidatePath } from "next/cache";

const PATH = "/admin/reschedule-requests";

export async function fetchAdminRescheduleRequests() {
  try {
    const supabase = await requireAdminFromActions();
    return loadAdminRescheduleRequests(supabase);
  } catch (e) {
    return {
      rows: [],
      error: e instanceof Error ? e.message : "Failed to load reschedule requests.",
    };
  }
}

export async function fetchAlternativeSlotsForRequest(tutorId: string, sessionStartsAt: string, sessionEndsAt: string) {
  try {
    const supabase = await requireAdminFromActions();
    const durationMinutes = Math.max(
      30,
      Math.round(
        (new Date(sessionEndsAt).getTime() - new Date(sessionStartsAt).getTime()) / 60000
      )
    );
    return loadAlternativeSlotsForTutor(supabase, tutorId, durationMinutes);
  } catch (e) {
    return {
      slots: [],
      error: e instanceof Error ? e.message : "Failed to load slots.",
    };
  }
}

export async function resolveAdminRescheduleRequest(input: {
  requestId: string;
  decision: "approved" | "denied";
  tutorResponse?: string;
  newStartsAt?: string;
  newEndsAt?: string;
}): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const { createClient } = await import("@/lib/supabase/server");
    const auth = await createClient();
    const {
      data: { user: adminUser },
    } = await auth.auth.getUser();
    if (!adminUser) return { error: "Unauthorized" };

    const { data: request, error: requestError } = await supabase
      .from("lesson_reschedule_requests")
      .select("id, session_id, status")
      .eq("id", input.requestId)
      .maybeSingle();

    if (requestError || !request) return { error: "Request not found." };
    if (request.status !== "pending") return { error: "Already resolved." };

    if (input.decision === "approved") {
      if (!input.newStartsAt || !input.newEndsAt) {
        return { error: "Select an alternative time to approve." };
      }
      const applied = await applyRescheduleSlotToSession(supabase, {
        sessionId: request.session_id,
        startsAt: input.newStartsAt,
        endsAt: input.newEndsAt,
      });
      if (!applied.ok) return { error: applied.error };
    }

    const responseNote =
      input.decision === "approved"
        ? input.tutorResponse?.trim() ||
          `Rescheduled to ${new Date(input.newStartsAt!).toLocaleString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          })}`
        : input.tutorResponse?.trim() || null;

    const { error } = await supabase
      .from("lesson_reschedule_requests")
      .update({
        status: input.decision,
        tutor_response: responseNote,
        resolved_at: new Date().toISOString(),
        resolved_by: adminUser.id,
      })
      .eq("id", input.requestId)
      .eq("status", "pending");

    if (error) return { error: error.message };

    revalidatePath(PATH);
    revalidatePath("/dashboard/schedule");
    revalidatePath("/dashboard/tutor/requests");
    return {
      success:
        input.decision === "approved"
          ? "Approved — booking and calendar updated."
          : "Request declined.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to resolve request." };
  }
}
