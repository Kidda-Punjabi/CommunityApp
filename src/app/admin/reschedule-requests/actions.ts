"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import {
  loadAdminRescheduleRequests,
  loadAlternativeSlotsForTutor,
} from "@/lib/admin/load-admin-reschedule-requests";
import { applyRescheduleSlotToSession } from "@/lib/calendar/tutor-cover";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
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
      .select("id, session_id, student_id, status, requested_starts_at, requested_ends_at")
      .eq("id", input.requestId)
      .maybeSingle();

    if (requestError || !request) return { error: "Request not found." };
    if (request.status !== "pending") return { error: "Already resolved." };

    const approvedStartsAt =
      input.decision === "approved"
        ? input.newStartsAt?.trim() || (request.requested_starts_at as string | null)
        : null;
    const approvedEndsAt =
      input.decision === "approved"
        ? input.newEndsAt?.trim() || (request.requested_ends_at as string | null)
        : null;

    if (input.decision === "approved" && (!approvedStartsAt || !approvedEndsAt)) {
      return { error: "Select an alternative time to approve." };
    }

    if (input.decision === "approved") {
      const applied = await applyRescheduleSlotToSession(supabase, {
        sessionId: request.session_id,
        startsAt: approvedStartsAt!,
        endsAt: approvedEndsAt!,
      });
      if (!applied.ok) return { error: applied.error };
    }

    const responseNote =
      input.decision === "approved"
        ? input.tutorResponse?.trim() ||
          `Rescheduled to ${formatSessionWhen(approvedStartsAt!, approvedEndsAt!)}`
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

    if (input.decision === "denied") {
      const { unlockLessonForStudentAfterLateDeniedReschedule } = await import(
        "@/lib/catchup/session-catchup-eligibility"
      );
      await unlockLessonForStudentAfterLateDeniedReschedule(supabase, {
        studentId: request.student_id,
        sessionId: request.session_id,
        unlockedBy: adminUser.id,
      });
    }

    revalidatePath(PATH);
    revalidatePath("/dashboard/schedule");
    revalidatePath("/dashboard/learn");
    revalidatePath("/dashboard/tutor/requests");
    return {
      success:
        input.decision === "approved"
          ? "Approved — booking and calendar updated."
          : "Request declined. If this was a late cancel, the lesson is unlocked with Session catch-up.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to resolve request." };
  }
}
