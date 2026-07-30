import "server-only";

import type { CohortCalendarCandidate } from "@/lib/admin/packages/cohort-calendar-link";
import { listGoogleCalendarEvents } from "@/lib/calendar/google-calendar-api";
import {
  getValidTutorAccessToken,
  type TutorCalendarConnectionRow,
} from "@/lib/calendar/tutor-access-token";
import type { GoogleCalendarEvent } from "@/lib/calendar/types";
import {
  formatSessionTimeRangeUk,
  minutesOfDayInTimezone,
  UK_DISPLAY_TIMEZONE,
  weekdayNameInTimezone,
} from "@/lib/calendar/uk-display-time";
import type { SupabaseClient } from "@supabase/supabase-js";

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function minutesOfDay(iso: string): number | null {
  return minutesOfDayInTimezone(iso, UK_DISPLAY_TIMEZONE);
}

function scoreEvent(params: {
  event: GoogleCalendarEvent;
  instanceName: string;
  courseName: string;
  studentNames: string[];
  startDayOfWeek: string | null;
}): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const title = normalizeTitle(params.event.summary);
  const instanceNorm = normalizeTitle(params.instanceName);
  const courseNorm = normalizeTitle(params.courseName);

  if (instanceNorm && title.includes(instanceNorm)) {
    score += 50;
    reasons.push("Title matches package name");
  } else if (courseNorm && title.includes(courseNorm)) {
    score += 30;
    reasons.push("Title matches course name");
  } else {
    for (const studentName of params.studentNames) {
      const studentNorm = normalizeTitle(studentName);
      if (studentNorm && title.includes(studentNorm)) {
        score += 40;
        reasons.push("Title matches student name");
        break;
      }
    }
  }

  if (
    title.includes("1-1") ||
    title.includes("1 to 1") ||
    title.includes("one to one") ||
    title.includes("beginner") ||
    title.includes("punjabi")
  ) {
    score += 10;
    reasons.push("Title looks like a 1-to-1 class");
  }

  const eventDay = weekdayNameInTimezone(params.event.start, UK_DISPLAY_TIMEZONE);
  if (params.startDayOfWeek && eventDay.toLowerCase() === params.startDayOfWeek.toLowerCase()) {
    score += 25;
    reasons.push(`Same weekday (${eventDay})`);
  }

  if (params.event.recurringEventId) {
    score += 5;
    reasons.push("Recurring series");
  }

  return { score, reasons };
}

async function loadInstanceContext(
  supabase: SupabaseClient,
  packageInstanceId: string
): Promise<
  | {
      ok: true;
      instance: {
        id: string;
        name: string;
        tutor_id: string | null;
        course_id: string;
        start_day_of_week: string | null;
      };
      courseName: string;
      studentIds: string[];
      studentNames: string[];
    }
  | { ok: false; error: string }
  | { ok: true; state: "no_tutor" | "no_student" | "no_connection"; studentIds: string[] }
> {
  const { data: instance, error: instanceError } = await supabase
    .from("package_instances")
    .select("id, name, tutor_id, course_id, start_day_of_week, courses(name)")
    .eq("id", packageInstanceId)
    .maybeSingle();

  if (instanceError) return { ok: false, error: instanceError.message };
  if (!instance) return { ok: false, error: "Package run not found." };
  if (!instance.tutor_id) {
    return { ok: true, state: "no_tutor", studentIds: [] };
  }

  const { data: studentPackages, error: spError } = await supabase
    .from("student_packages")
    .select("user_id")
    .eq("package_instance_id", packageInstanceId)
    .eq("status", "confirmed");

  if (spError) return { ok: false, error: spError.message };

  const studentIds = [...new Set((studentPackages ?? []).map((row) => row.user_id))];
  if (studentIds.length === 0) {
    return { ok: true, state: "no_student", studentIds: [] };
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name")
    .in("id", studentIds);

  const studentNames = (profiles ?? [])
    .map((profile) => profile.preferred_name ?? profile.full_name)
    .filter((name): name is string => Boolean(name?.trim()));

  const courseRel = Array.isArray(instance.courses) ? instance.courses[0] : instance.courses;

  return {
    ok: true,
    instance: {
      id: instance.id,
      name: instance.name,
      tutor_id: instance.tutor_id,
      course_id: instance.course_id,
      start_day_of_week: instance.start_day_of_week,
    },
    courseName: (courseRel as { name?: string } | null)?.name ?? "",
    studentIds,
    studentNames,
  };
}

export async function searchPackageInstanceCalendarCandidates(
  supabase: SupabaseClient,
  packageInstanceId: string
): Promise<
  | { ok: true; candidates: CohortCalendarCandidate[]; state: "ok" | "no_tutor" | "no_connection" | "no_student" }
  | { ok: false; error: string }
> {
  const context = await loadInstanceContext(supabase, packageInstanceId);
  if (!context.ok) return context;
  if ("state" in context) {
    return { ok: true, candidates: [], state: context.state };
  }

  const { instance, courseName, studentIds, studentNames } = context;

  const { data: connection, error: connectionError } = await supabase
    .from("tutor_google_calendar_connections")
    .select(
      "tutor_id, google_account_email, calendar_id, access_token, refresh_token, token_expires_at"
    )
    .eq("tutor_id", instance.tutor_id)
    .maybeSingle();

  if (connectionError) return { ok: false, error: connectionError.message };
  if (!connection) {
    return { ok: true, candidates: [], state: "no_connection" };
  }

  const accessToken = await getValidTutorAccessToken(
    supabase,
    connection as TutorCalendarConnectionRow
  );

  const now = Date.now();
  const timeMin = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now + 56 * 24 * 60 * 60 * 1000).toISOString();

  const { events } = await listGoogleCalendarEvents(accessToken, connection.calendar_id, {
    timeMin,
    timeMax,
  });

  const { data: linkedElsewhere } = await supabase
    .from("tutor_scheduled_sessions")
    .select("google_recurring_event_id, student_id")
    .not("google_recurring_event_id", "is", null)
    .is("cohort_id", null)
    .not("student_id", "is", null);

  const takenSeries = new Set(
    (linkedElsewhere ?? [])
      .filter((row) => row.student_id && !studentIds.includes(row.student_id))
      .map((row) => row.google_recurring_event_id)
      .filter((id): id is string => Boolean(id))
  );

  const bySeries = new Map<string, GoogleCalendarEvent>();
  for (const event of events) {
    const seriesId = event.recurringEventId ?? event.id;
    if (takenSeries.has(seriesId)) continue;
    const existing = bySeries.get(seriesId);
    if (!existing || event.start < existing.start) {
      bySeries.set(seriesId, event);
    }
  }

  const candidates: CohortCalendarCandidate[] = [];
  for (const [seriesId, event] of bySeries) {
    const { score, reasons } = scoreEvent({
      event,
      instanceName: instance.name,
      courseName,
      studentNames,
      startDayOfWeek: instance.start_day_of_week,
    });
    if (score < 10) continue;

    candidates.push({
      googleEventId: event.id,
      recurringEventId: seriesId,
      title: event.summary,
      nextStartsAt: event.start,
      nextEndsAt: event.end,
      weekday: weekdayNameInTimezone(event.start, UK_DISPLAY_TIMEZONE),
      timeLabel: formatSessionTimeRangeUk(event.start, event.end),
      score,
      reasons,
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.nextStartsAt.localeCompare(b.nextStartsAt));

  return { ok: true, candidates: candidates.slice(0, 12), state: "ok" };
}

export async function linkPackageInstanceRecurringCalendarEvent(
  supabase: SupabaseClient,
  params: {
    packageInstanceId: string;
    googleEventId: string;
    recurringEventId: string;
    title: string;
    startsAt: string;
    endsAt: string;
  }
): Promise<{ ok: boolean; error?: string; linkedCount?: number }> {
  const context = await loadInstanceContext(supabase, params.packageInstanceId);
  if (!context.ok) return context;
  if ("state" in context) {
    if (context.state === "no_tutor") {
      return { ok: false, error: "Assign a tutor before linking a calendar event." };
    }
    return { ok: false, error: "Add a confirmed student before linking a calendar event." };
  }

  const { instance, studentIds } = context;
  const primaryStudentId = studentIds[0];
  if (!primaryStudentId || !instance.tutor_id) {
    return { ok: false, error: "Missing tutor or confirmed student." };
  }

  const now = new Date().toISOString();
  const seriesId = params.recurringEventId.trim();
  const eventId = params.googleEventId.trim();

  if (seriesId) {
    const { data: seriesRows, error: seriesLookupError } = await supabase
      .from("tutor_scheduled_sessions")
      .select("id, student_id, google_event_id")
      .eq("tutor_id", instance.tutor_id)
      .eq("google_recurring_event_id", seriesId);

    if (seriesLookupError) return { ok: false, error: seriesLookupError.message };

    const updatable = (seriesRows ?? []).filter(
      (row) => !row.student_id || studentIds.includes(row.student_id)
    );

    if (updatable.length > 0) {
      const { error: updateError } = await supabase
        .from("tutor_scheduled_sessions")
        .update({
          student_id: primaryStudentId,
          cohort_id: null,
          course_id: instance.course_id,
          match_method: "manual",
          rescheduling_allowed: true,
          updated_at: now,
        })
        .in(
          "id",
          updatable.map((row) => row.id)
        );

      if (updateError) return { ok: false, error: updateError.message };
      return { ok: true, linkedCount: updatable.length };
    }
  }

  const { data: byEvent, error: byEventError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("id, student_id")
    .eq("tutor_id", instance.tutor_id)
    .eq("google_event_id", eventId)
    .maybeSingle();

  if (byEventError) return { ok: false, error: byEventError.message };

  if (byEvent) {
    if (byEvent.student_id && !studentIds.includes(byEvent.student_id)) {
      return {
        ok: false,
        error: "This calendar event is already linked to a different student.",
      };
    }

    const { error: updateError } = await supabase
      .from("tutor_scheduled_sessions")
      .update({
        student_id: primaryStudentId,
        cohort_id: null,
        course_id: instance.course_id,
        google_recurring_event_id: seriesId || null,
        match_method: "manual",
        rescheduling_allowed: true,
        title: params.title,
        starts_at: params.startsAt,
        ends_at: params.endsAt,
        updated_at: now,
      })
      .eq("id", byEvent.id);

    if (updateError) return { ok: false, error: updateError.message };
    return { ok: true, linkedCount: 1 };
  }

  const { error: insertError } = await supabase.from("tutor_scheduled_sessions").insert({
    tutor_id: instance.tutor_id,
    student_id: primaryStudentId,
    cohort_id: null,
    course_id: instance.course_id,
    google_event_id: eventId,
    google_recurring_event_id: seriesId || null,
    title: params.title,
    starts_at: params.startsAt,
    ends_at: params.endsAt,
    match_method: "manual",
    status: "scheduled",
    rescheduling_allowed: true,
  });

  if (insertError) return { ok: false, error: insertError.message };
  return { ok: true, linkedCount: 1 };
}

export async function unlinkPackageInstanceRecurringCalendarEvent(
  supabase: SupabaseClient,
  params: { packageInstanceId: string }
): Promise<{ ok: boolean; error?: string; unlinkedCount?: number }> {
  const context = await loadInstanceContext(supabase, params.packageInstanceId);
  if (!context.ok) return context;
  if ("state" in context) {
    return { ok: false, error: "Package run is missing tutor or confirmed student." };
  }

  const { instance, studentIds } = context;
  if (!instance.tutor_id) return { ok: false, error: "Package run has no tutor assigned." };

  const { data: linkedRows, error: linkedError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("id, google_event_id, google_recurring_event_id")
    .eq("tutor_id", instance.tutor_id)
    .in("student_id", studentIds)
    .eq("course_id", instance.course_id)
    .is("cohort_id", null);

  if (linkedError) return { ok: false, error: linkedError.message };
  if (!linkedRows?.length) return { ok: true, unlinkedCount: 0 };

  const now = new Date().toISOString();
  const unlinkPatch = {
    student_id: null,
    match_method: "unmatched" as const,
    updated_at: now,
  };

  const seriesIds = [
    ...new Set(
      linkedRows
        .map((row) => row.google_recurring_event_id?.trim())
        .filter((id): id is string => Boolean(id))
    ),
  ];

  if (seriesIds.length > 0) {
    const { data: seriesRows, error: seriesLookupError } = await supabase
      .from("tutor_scheduled_sessions")
      .select("id, student_id")
      .eq("tutor_id", instance.tutor_id)
      .in("google_recurring_event_id", seriesIds);

    if (seriesLookupError) return { ok: false, error: seriesLookupError.message };

    const updatable = (seriesRows ?? []).filter(
      (row) => row.student_id && studentIds.includes(row.student_id)
    );
    if (updatable.length === 0) {
      return { ok: false, error: "No linked calendar sessions for this package run." };
    }

    const { error: updateError } = await supabase
      .from("tutor_scheduled_sessions")
      .update(unlinkPatch)
      .in(
        "id",
        updatable.map((row) => row.id)
      );

    if (updateError) return { ok: false, error: updateError.message };
    return { ok: true, unlinkedCount: updatable.length };
  }

  const eventIds = [
    ...new Set(
      linkedRows
        .map((row) => row.google_event_id?.trim())
        .filter((id): id is string => Boolean(id))
    ),
  ];

  if (eventIds.length === 0) {
    return { ok: false, error: "Linked sessions are missing Google event ids." };
  }

  const { data: byEventRows, error: byEventError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("id, student_id")
    .eq("tutor_id", instance.tutor_id)
    .in("google_event_id", eventIds);

  if (byEventError) return { ok: false, error: byEventError.message };

  const updatable = (byEventRows ?? []).filter(
    (row) => row.student_id && studentIds.includes(row.student_id)
  );
  if (updatable.length === 0) {
    return { ok: false, error: "No linked calendar sessions for this package run." };
  }

  const { error: updateError } = await supabase
    .from("tutor_scheduled_sessions")
    .update(unlinkPatch)
    .in(
      "id",
      updatable.map((row) => row.id)
    );

  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true, unlinkedCount: updatable.length };
}

export async function relinkPackageInstanceRecurringCalendarEvent(
  supabase: SupabaseClient,
  params: {
    packageInstanceId: string;
    googleEventId: string;
    recurringEventId: string;
    title: string;
    startsAt: string;
    endsAt: string;
  }
): Promise<{ ok: boolean; error?: string; unlinkedCount?: number; linkedCount?: number }> {
  const unlinked = await unlinkPackageInstanceRecurringCalendarEvent(supabase, {
    packageInstanceId: params.packageInstanceId,
  });
  if (!unlinked.ok) return unlinked;

  const linked = await linkPackageInstanceRecurringCalendarEvent(supabase, params);
  if (!linked.ok) return linked;

  return {
    ok: true,
    unlinkedCount: unlinked.unlinkedCount,
    linkedCount: linked.linkedCount,
  };
}
