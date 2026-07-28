"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import {
  countPendingCohortSwitchRequests,
  loadAdminCohortSwitchRequests,
} from "@/lib/admin/load-admin-cohort-switch-requests";
import { addAttendeeToGoogleCalendarEvent } from "@/lib/calendar/google-calendar-api";
import {
  getValidTutorAccessToken,
  type TutorCalendarConnectionRow,
} from "@/lib/calendar/tutor-access-token";
import { revalidatePath } from "next/cache";

const PATH = "/admin/cohort-switch-requests";

export async function fetchAdminCohortSwitchRequests() {
  try {
    const supabase = await requireAdminFromActions();
    return loadAdminCohortSwitchRequests(supabase);
  } catch (e) {
    return {
      rows: [],
      error: e instanceof Error ? e.message : "Failed to load cohort change requests.",
    };
  }
}

export async function fetchPendingCohortSwitchCount(): Promise<{
  count: number;
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    return countPendingCohortSwitchRequests(supabase);
  } catch (e) {
    return {
      count: 0,
      error: e instanceof Error ? e.message : "Failed to count cohort change requests.",
    };
  }
}

async function tryInviteStudentToTargetSession(
  supabase: Awaited<ReturnType<typeof requireAdminFromActions>>,
  params: { toSessionId: string | null; studentId: string }
): Promise<{ invited: boolean; warning?: string }> {
  if (!params.toSessionId) {
    return {
      invited: false,
      warning: "Approved, but no target session was stored — add the student to the calendar invite manually.",
    };
  }

  const { data: session, error: sessionError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("id, tutor_id, google_event_id")
    .eq("id", params.toSessionId)
    .maybeSingle();

  if (sessionError || !session?.google_event_id) {
    return {
      invited: false,
      warning: "Approved, but the target calendar event was not found — invite the student manually.",
    };
  }

  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(
    params.studentId
  );
  const studentEmail = authUser.user?.email?.trim();
  if (authError || !studentEmail) {
    return {
      invited: false,
      warning: "Approved, but the student has no email for a calendar invite.",
    };
  }

  const { data: connection, error: connectionError } = await supabase
    .from("tutor_google_calendar_connections")
    .select(
      "tutor_id, google_account_email, calendar_id, access_token, refresh_token, token_expires_at"
    )
    .eq("tutor_id", session.tutor_id)
    .maybeSingle();

  if (connectionError || !connection) {
    return {
      invited: false,
      warning:
        "Approved, but the destination tutor has no Google Calendar connection — invite the student manually.",
    };
  }

  try {
    const accessToken = await getValidTutorAccessToken(
      supabase,
      connection as TutorCalendarConnectionRow
    );
    await addAttendeeToGoogleCalendarEvent(
      accessToken,
      connection.calendar_id as string,
      session.google_event_id as string,
      studentEmail
    );
    return { invited: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Calendar invite failed.";
    return {
      invited: false,
      warning: `Approved, but calendar invite failed: ${message}`,
    };
  }
}

export async function resolveAdminCohortSwitchRequest(input: {
  requestId: string;
  decision: "approved" | "denied";
  adminResponse?: string;
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
      .from("cohort_switch_requests")
      .select("id, status, student_id, to_session_id, to_cohort_id")
      .eq("id", input.requestId)
      .maybeSingle();

    if (requestError || !request) return { error: "Request not found." };
    if (request.status !== "pending") return { error: "Already resolved." };

    let calendarWarning: string | undefined;
    if (input.decision === "approved") {
      const invite = await tryInviteStudentToTargetSession(supabase, {
        toSessionId: (request.to_session_id as string | null) ?? null,
        studentId: request.student_id as string,
      });
      calendarWarning = invite.warning;
    }

    const responseNote =
      input.adminResponse?.trim() ||
      (input.decision === "approved"
        ? "Your alternate cohort request was approved. Check your calendar for the updated invite."
        : null);

    const { error } = await supabase
      .from("cohort_switch_requests")
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
    revalidatePath("/admin/content");
    revalidatePath("/dashboard/schedule");
    revalidatePath("/dashboard/learn");

    if (input.decision === "approved") {
      return {
        success: calendarWarning
          ? calendarWarning
          : "Approved — student invited to the alternate session calendar.",
      };
    }

    return { success: "Request declined." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to resolve request." };
  }
}
