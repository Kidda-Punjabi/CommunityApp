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

  revalidatePath("/dashboard/tutor/calendar");
  revalidatePath("/dashboard/schedule");
  revalidatePath("/admin/content/calendar");
  return {
    success:
      scope === "series"
        ? "Recurring series hidden from lesson views — still visible in admin calendar."
        : "Hidden from lesson views — still visible in admin calendar.",
  };
}

export async function linkSessionToPackage(
  sessionId: string,
  studentPackageId: string,
  scope: "event" | "series" = "event"
): Promise<CalendarActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: session, error: sessionError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("id, tutor_id, course_id, google_recurring_event_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError || !session) return { error: "Lesson not found." };
  if (session.tutor_id !== user.id) return { error: "Not allowed." };

  const { data: pkg, error: pkgError } = await supabase
    .from("student_packages")
    .select("id, course_id")
    .eq("id", studentPackageId)
    .maybeSingle();
  if (pkgError || !pkg) return { error: "Package not found." };
  if (pkg.course_id !== session.course_id) return { error: "Package is from a different course." };

  if (scope === "series" && !session.google_recurring_event_id) {
    return { error: "This event is not part of a recurring series." };
  }

  const { client: adminClient, error: configError } = tryCreateServiceRoleClient();
  if (!adminClient) return { error: configError };

  let sessionIds = [session.id];
  if (scope === "series" && session.google_recurring_event_id) {
    const { data: seriesRows } = await adminClient
      .from("tutor_scheduled_sessions")
      .select("id")
      .eq("tutor_id", user.id)
      .eq("google_recurring_event_id", session.google_recurring_event_id)
      .eq("status", "scheduled");
    sessionIds = [...new Set((seriesRows ?? []).map((row) => row.id))];
  }

  const payload = sessionIds.map((id) => ({
    session_id: id,
    tutor_id: user.id,
    student_package_id: studentPackageId,
    link_scope: scope,
    linked_by: user.id,
    linked_at: new Date().toISOString(),
  }));

  const { error } = await adminClient
    .from("tutor_session_package_links")
    .upsert(payload, { onConflict: "session_id" });

  if (error) {
    if (error.code === "PGRST205" || error.message?.includes("tutor_session_package_links")) {
      return { error: "Package linking tables are not set up yet. Run supabase/tutor-session-package-tracking.sql." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/tutor/calendar");
  revalidatePath("/admin/content/calendar");
  return {
    success:
      scope === "series"
        ? `Package linked to ${sessionIds.length} lessons in this recurring series.`
        : "Package linked to this lesson.",
  };
}

export async function updateTutorSessionLog(
  _prev: CalendarActionResult,
  formData: FormData
): Promise<CalendarActionResult> {
  const sessionId = String(formData.get("session_id") ?? "").trim();
  const completed = formData.get("completed") === "on";
  const attendanceStatusRaw = String(formData.get("attendance_status") ?? "").trim();
  const attendanceStatus =
    attendanceStatusRaw === "present" ||
    attendanceStatusRaw === "absent_notified" ||
    attendanceStatusRaw === "absent_unnotified"
      ? attendanceStatusRaw
      : null;
  const attendanceMarked = attendanceStatus !== null;
  const homeworkMarked = formData.get("homework_marked") === "on";
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!sessionId) return { error: "Session id is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: session, error: sessionError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("id, tutor_id, student_id, starts_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError || !session) return { error: "Lesson not found." };
  if (session.tutor_id !== user.id) return { error: "Not allowed." };

  const { client: adminClient, error: configError } = tryCreateServiceRoleClient();
  if (!adminClient) return { error: configError };

  const { data: previousLog } = await adminClient
    .from("tutor_session_logs")
    .select("attendance_status")
    .eq("session_id", sessionId)
    .maybeSingle();

  const now = new Date().toISOString();
  const { error } = await adminClient.from("tutor_session_logs").upsert(
    {
      session_id: sessionId,
      tutor_id: user.id,
      completed,
      attendance_marked: attendanceMarked,
      attendance_status: attendanceStatus,
      homework_marked: homeworkMarked,
      notes,
      completed_at: completed ? now : null,
      attendance_marked_at: attendanceMarked ? now : null,
      homework_marked_at: homeworkMarked ? now : null,
      updated_by: user.id,
      updated_at: now,
    },
    { onConflict: "session_id" }
  );

  if (error) {
    if (error.code === "PGRST205" || error.message?.includes("tutor_session_logs")) {
      return { error: "Lesson logging tables are not set up yet. Run supabase/tutor-session-package-tracking.sql." };
    }
    return { error: error.message };
  }

  const becameUnnotifiedAbsence =
    attendanceStatus === "absent_unnotified" && previousLog?.attendance_status !== "absent_unnotified";

  if (becameUnnotifiedAbsence && session.student_id) {
    const firstBody =
      "Hey, we didn't see you at the session today. Hope everything's all right. Please, in the future, do let us know that you won't be able to make sessions, and also please catch up on the session recording in your Learn section.";
    await adminClient.rpc("_create_notification", {
      p_user_id: session.student_id,
      p_type: "announcement",
      p_actor_user_id: null,
      p_payload: {
        title: "We missed you today",
        body: firstBody,
        category: "attendance_absent_unnotified",
        session_id: sessionId,
      },
    });

    const { data: recentSessions } = await adminClient
      .from("tutor_scheduled_sessions")
      .select("id, starts_at")
      .eq("tutor_id", user.id)
      .eq("student_id", session.student_id)
      .eq("status", "scheduled")
      .lte("starts_at", session.starts_at)
      .order("starts_at", { ascending: false })
      .limit(12);

    const recentSessionIds = (recentSessions ?? []).map((row) => row.id as string);
    if (recentSessionIds.length > 0) {
      const { data: recentLogs } = await adminClient
        .from("tutor_session_logs")
        .select("session_id, attendance_status")
        .in("session_id", recentSessionIds);

      const logBySessionId = new Map(
        (recentLogs ?? []).map((row) => [row.session_id as string, row.attendance_status as string | null])
      );
      const statuses = recentSessionIds
        .map((id) => logBySessionId.get(id) ?? null)
        .filter((value): value is string => Boolean(value));

      if (
        statuses.length >= 2 &&
        statuses[0] === "absent_unnotified" &&
        statuses[1] === "absent_unnotified" &&
        statuses[2] !== "absent_unnotified"
      ) {
        const warningBody =
          "Hey, we've noticed that you haven't attended two sessions and you haven't let the tutor know. Moving forward, please let us know otherwise, to keep the experience fair for all students. Please let us know if you're unable to make it. If something serious has happened, please inform your tutor, as we want to support you. You may be removed from the course if you are not actively participating.";
        await adminClient.rpc("_create_notification", {
          p_user_id: session.student_id,
          p_type: "announcement",
          p_actor_user_id: null,
          p_payload: {
            title: "Attendance warning",
            body: warningBody,
            category: "attendance_consecutive_absent_unnotified",
            session_id: sessionId,
          },
        });
      }
    }
  }

  revalidatePath("/dashboard/tutor/calendar");
  revalidatePath("/admin/content/calendar");
  return { success: "Lesson log saved." };
}
