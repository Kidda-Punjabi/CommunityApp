"use server";

import { revalidatePath } from "next/cache";
import { COHORT_SWITCH_CUTOFF_MS } from "@/lib/calendar/constants";
import { getCohortSwitchEligibility } from "@/lib/calendar/cohort-switch-policy";
import { getRescheduleEligibility, GROUP_LESSON_NO_RESCHEDULE_REASON } from "@/lib/calendar/reschedule-policy";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";

export type CalendarActionResult = { error?: string; success?: string };

export async function disconnectGoogleCalendar(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("disconnect_tutor_google_calendar");
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/tutor/calendar");
}

export async function requestLessonReschedule(
  _prev: CalendarActionResult,
  formData: FormData
): Promise<CalendarActionResult> {
  const sessionId = String(formData.get("session_id") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const preferredTimes = String(formData.get("preferred_times") ?? "").trim();

  if (!sessionId) return { error: "Missing lesson." };
  if (!message) return { error: "Please explain why you need to reschedule." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: session, error: sessionError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !session) return { error: "Lesson not found." };

  if (session.cohort_id) {
    return { error: GROUP_LESSON_NO_RESCHEDULE_REASON };
  }

  const { data: existing } = await supabase
    .from("lesson_reschedule_requests")
    .select("*")
    .eq("session_id", sessionId)
    .eq("student_id", user.id)
    .maybeSingle();

  const eligibility = getRescheduleEligibility(session, existing ?? null);
  if (!eligibility.canRequest) {
    return { error: eligibility.lockedReason ?? "Cannot request reschedule." };
  }

  const { error } = await supabase.from("lesson_reschedule_requests").insert({
    session_id: sessionId,
    student_id: user.id,
    message,
    preferred_times: preferredTimes || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/schedule");
  return { success: "Reschedule request sent to your tutor." };
}

export async function cancelRescheduleRequest(requestId: string): Promise<CalendarActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lesson_reschedule_requests")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) return { error: error.message };

  revalidatePath("/dashboard/schedule");
  return { success: "Request cancelled." };
}

export async function resolveRescheduleRequest(
  _prev: CalendarActionResult,
  formData: FormData
): Promise<CalendarActionResult> {
  const requestId = String(formData.get("request_id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const tutorResponse = String(formData.get("tutor_response") ?? "").trim();

  if (!requestId || !["approved", "denied"].includes(decision)) {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("lesson_reschedule_requests")
    .update({
      status: decision,
      tutor_response: tutorResponse || null,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) return { error: error.message };

  revalidatePath("/dashboard/tutor/calendar");
  revalidatePath("/dashboard/tutor/requests");
  return {
    success:
      decision === "approved"
        ? "Request approved. Update the time in Google Calendar, then sync."
        : "Request declined.",
  };
}

export async function requestCohortSwitch(
  _prev: CalendarActionResult,
  formData: FormData
): Promise<CalendarActionResult> {
  const sessionId = String(formData.get("session_id") ?? "").trim();
  const toCohortId = String(formData.get("to_cohort_id") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!sessionId || !toCohortId) return { error: "Missing lesson or cohort." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: session, error: sessionError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !session) return { error: "Lesson not found." };
  if (!session.cohort_id) return { error: "This is not a group lesson." };

  const msUntilStart = new Date(session.starts_at).getTime() - Date.now();
  if (msUntilStart < COHORT_SWITCH_CUTOFF_MS) {
    return {
      error: "You need to let us know at least 3 days before the lesson to request a different cohort.",
    };
  }

  const { data: currentCohort, error: currentCohortError } = await supabase
    .from("cohorts")
    .select("id, tutor_id, course_id, active")
    .eq("id", session.cohort_id)
    .maybeSingle();

  if (currentCohortError || !currentCohort) return { error: "Cohort not found." };

  const { data: targetCohort, error: targetCohortError } = await supabase
    .from("cohorts")
    .select("id, tutor_id, course_id, active")
    .eq("id", toCohortId)
    .maybeSingle();

  if (targetCohortError || !targetCohort || !targetCohort.active) {
    return { error: "Alternate cohort not found." };
  }

  if (
    targetCohort.id === currentCohort.id ||
    targetCohort.tutor_id !== currentCohort.tutor_id ||
    targetCohort.course_id !== currentCohort.course_id
  ) {
    return { error: "Invalid alternate cohort." };
  }

  const { data: existing } = await supabase
    .from("cohort_switch_requests")
    .select("*")
    .eq("session_id", sessionId)
    .eq("student_id", user.id)
    .maybeSingle();

  const { data: alternateCohorts } = await supabase
    .from("cohorts")
    .select("id")
    .eq("tutor_id", currentCohort.tutor_id)
    .eq("course_id", currentCohort.course_id)
    .eq("active", true)
    .neq("id", session.cohort_id);

  const eligibility = getCohortSwitchEligibility(
    session,
    existing ?? null,
    (alternateCohorts ?? []).length
  );
  if (!eligibility.canRequest) {
    return { error: eligibility.lockedReason ?? "Cannot request alternate cohort." };
  }

  const { error } = await supabase.from("cohort_switch_requests").insert({
    session_id: sessionId,
    student_id: user.id,
    from_cohort_id: session.cohort_id,
    to_cohort_id: toCohortId,
    message: message || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/schedule");
  return { success: "Alternate cohort request sent to your tutor." };
}

export async function cancelCohortSwitchRequest(requestId: string): Promise<CalendarActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cohort_switch_requests")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) return { error: error.message };

  revalidatePath("/dashboard/schedule");
  return { success: "Request cancelled." };
}

export async function resolveCohortSwitchRequest(
  _prev: CalendarActionResult,
  formData: FormData
): Promise<CalendarActionResult> {
  const requestId = String(formData.get("request_id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const tutorResponse = String(formData.get("tutor_response") ?? "").trim();

  if (!requestId || !["approved", "denied"].includes(decision)) {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("cohort_switch_requests")
    .update({
      status: decision,
      tutor_response: tutorResponse || null,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) return { error: error.message };

  revalidatePath("/dashboard/tutor/requests");
  revalidatePath("/dashboard/tutor/calendar");
  return {
    success:
      decision === "approved"
        ? "Request approved. Add the student to the alternate cohort's calendar invite if you can accommodate it."
        : "Request declined.",
  };
}

export async function setSessionReschedulingAllowed(
  sessionId: string,
  allowed: boolean
): Promise<CalendarActionResult> {
  const supabase = await createClient();
  const { data: session, error: sessionError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("cohort_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !session) return { error: "Lesson not found." };
  if (session.cohort_id) {
    return { error: "Group lessons can't be rescheduled — students can only request a different cohort." };
  }

  const { error } = await supabase
    .from("tutor_scheduled_sessions")
    .update({ rescheduling_allowed: allowed, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/tutor/calendar");
  return { success: allowed ? "Rescheduling enabled." : "Rescheduling locked for this lesson." };
}

export async function excludeCalendarSession(
  sessionId: string,
  scope: "event" | "series"
): Promise<CalendarActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: session, error: sessionError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("id, tutor_id, google_event_id, google_recurring_event_id, title")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !session) return { error: "Lesson not found." };
  if (session.tutor_id !== user.id) return { error: "Not allowed." };

  if (scope === "series" && !session.google_recurring_event_id) {
    return {
      error: "This is not a recurring event. Use “Not a lesson” to hide this event only.",
    };
  }

  const { client: adminClient, error: configError } = tryCreateServiceRoleClient();
  if (!adminClient) return { error: configError };

  let exclusionError: { code?: string; message: string } | null = null;

  if (scope === "series" && session.google_recurring_event_id) {
    await adminClient
      .from("tutor_calendar_event_exclusions")
      .delete()
      .eq("tutor_id", user.id)
      .eq("google_recurring_event_id", session.google_recurring_event_id);

    const { error } = await adminClient.from("tutor_calendar_event_exclusions").insert({
      tutor_id: user.id,
      google_recurring_event_id: session.google_recurring_event_id,
      google_event_id: null,
      title: session.title,
      scope: "series",
    });
    exclusionError = error;
  } else {
    await adminClient
      .from("tutor_calendar_event_exclusions")
      .delete()
      .eq("tutor_id", user.id)
      .eq("google_event_id", session.google_event_id);

    const { error } = await adminClient.from("tutor_calendar_event_exclusions").insert({
      tutor_id: user.id,
      google_event_id: session.google_event_id,
      google_recurring_event_id: null,
      title: session.title,
      scope: "event",
    });
    exclusionError = error;
  }

  if (exclusionError) {
    if (exclusionError.code === "PGRST205") {
      return { error: "Calendar exclusions are not set up yet. Run the latest SQL migration." };
    }
    return { error: exclusionError.message };
  }

  if (scope === "series" && session.google_recurring_event_id) {
    const { error: deleteError } = await adminClient
      .from("tutor_scheduled_sessions")
      .delete()
      .eq("tutor_id", user.id)
      .eq("google_recurring_event_id", session.google_recurring_event_id);
    if (deleteError) return { error: deleteError.message };
  } else {
    const { error: deleteError } = await adminClient
      .from("tutor_scheduled_sessions")
      .delete()
      .eq("id", sessionId);
    if (deleteError) return { error: deleteError.message };
  }

  revalidatePath("/dashboard/tutor/calendar");
  revalidatePath("/dashboard/schedule");
  return {
    success:
      scope === "series"
        ? "Recurring series hidden — future occurrences will not sync as lessons."
        : "Removed from upcoming lessons.",
  };
}
