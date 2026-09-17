"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import {
  countPendingCohortSwitchRequests,
  loadAdminCohortSwitchRequests,
} from "@/lib/admin/load-admin-cohort-switch-requests";
import {
  buildRescheduleInviteNote,
  mergeCalendarInviteDescription,
} from "@/lib/calendar/cohort-switch-invite-copy";
import { addAttendeeToGoogleCalendarEvent } from "@/lib/calendar/google-calendar-api";
import { loadAlternateCohortSessionsForSource } from "@/lib/calendar/load-alternate-cohort-sessions";
import {
  KIDS_COHORT_AGE_GROUP_MISMATCH,
  kidsCohortsShareAgeGroup,
} from "@/lib/calendar/kids-cohort-age-group";
import { KIDS_CONTENT_TRACK } from "@/lib/learning/kids-courses";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import {
  getValidTutorAccessToken,
  type TutorCalendarConnectionRow,
} from "@/lib/calendar/tutor-access-token";
import { sendTutorCohortSwitchNotifyEmail } from "@/lib/email/send-cohort-switch-tutor-notify";
import { getDisplayName, getStaffFacingName } from "@/lib/profile/display-name";
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

function asWeekNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

async function loadSwitchStudentName(
  supabase: Awaited<ReturnType<typeof requireAdminFromActions>>,
  params: { studentId: string; fromCohortId: string | null }
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, preferred_name")
    .eq("id", params.studentId)
    .maybeSingle();
  const profileName = getStaffFacingName(profile) ?? getDisplayName(profile);

  if (!params.fromCohortId) return profileName ?? "Student";

  const { data: parentKids } = await supabase
    .from("cohort_members")
    .select("kid_profile_id, kid_profiles!inner(name, parent_user_id)")
    .eq("cohort_id", params.fromCohortId)
    .is("left_at", null)
    .not("kid_profile_id", "is", null);

  const kidMatch = (parentKids ?? []).find((row) => {
    const rel =
      row.kid_profiles as { name?: string; parent_user_id?: string } | { name?: string; parent_user_id?: string }[] | null;
    const kid = Array.isArray(rel) ? rel[0] : rel;
    return kid?.parent_user_id === params.studentId;
  });
  const kidRel =
    kidMatch?.kid_profiles as { name?: string } | { name?: string }[] | null | undefined;
  const kid = Array.isArray(kidRel) ? kidRel[0] : kidRel;
  const kidName = kid?.name?.trim();
  if (kidName) return kidName;

  return profileName ?? "Student";
}

async function loadCurriculumTopicForSession(
  supabase: Awaited<ReturnType<typeof requireAdminFromActions>>,
  params: { courseId: string | null; weekNumber: number | null }
): Promise<string | null> {
  if (!params.courseId || params.weekNumber == null) return null;
  const { data: lesson } = await supabase
    .from("lessons")
    .select("title")
    .eq("course_id", params.courseId)
    .eq("lesson_number", params.weekNumber)
    .maybeSingle();
  return lesson?.title?.trim() || null;
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
    .select("id, tutor_id, google_event_id, meet_link, week_number, cohort_id")
    .eq("id", params.toSessionId)
    .maybeSingle();

  if (sessionError || !session?.google_event_id) {
    return {
      invited: false,
      warning: "Approved, but the target calendar event was not found — invite the student manually.",
    };
  }

  const [{ data: authUser, error: authError }, { data: cohort }] = await Promise.all([
    supabase.auth.admin.getUserById(params.studentId),
    session.cohort_id
      ? supabase.from("cohorts").select("name").eq("id", session.cohort_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const studentEmail = authUser?.user?.email?.trim();
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
      studentEmail,
      {
        description: (event) =>
          mergeCalendarInviteDescription(
            event.description,
            buildRescheduleInviteNote({
              cohortName: (cohort?.name as string | null) ?? null,
              weekNumber: asWeekNumber(session.week_number),
              joinLink: (session.meet_link as string | null)?.trim() || event.hangoutLink,
            })
          ),
      }
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

async function tryNotifyDestinationTutor(
  supabase: Awaited<ReturnType<typeof requireAdminFromActions>>,
  params: {
    toSessionId: string | null;
    studentId: string;
    fromCohortId: string | null;
  }
): Promise<{ sent: boolean; warning?: string }> {
  if (!params.toSessionId) {
    return { sent: false };
  }

  const { data: session, error: sessionError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("id, tutor_id, cohort_id, course_id, week_number, starts_at, ends_at")
    .eq("id", params.toSessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return {
      sent: false,
      warning: "The destination tutor could not be notified (session not found).",
    };
  }

  // Group cohort switches only. 1-1 reschedules use lesson_reschedule_requests.
  if (!session.cohort_id) {
    return { sent: false };
  }

  const weekNumber = asWeekNumber(session.week_number);
  const [{ data: tutorUser, error: tutorAuthError }, studentName, topic, { data: cohort }] =
    await Promise.all([
      supabase.auth.admin.getUserById(session.tutor_id as string),
      loadSwitchStudentName(supabase, {
        studentId: params.studentId,
        fromCohortId: params.fromCohortId,
      }),
      loadCurriculumTopicForSession(supabase, {
        courseId: (session.course_id as string | null) ?? null,
        weekNumber,
      }),
      supabase.from("cohorts").select("name").eq("id", session.cohort_id).maybeSingle(),
    ]);

  const tutorEmail = tutorUser?.user?.email?.trim() ?? null;
  if (tutorAuthError || !tutorEmail) {
    return {
      sent: false,
      warning: "The destination tutor has no email for a notification.",
    };
  }

  const result = await sendTutorCohortSwitchNotifyEmail(tutorEmail, {
    studentName,
    weekNumber,
    topic,
    cohortName: (cohort?.name as string | null) ?? null,
    sessionWhen: formatSessionWhen(session.starts_at as string, session.ends_at as string),
  });

  if (result.error) {
    console.error("[cohort-switch] tutor notify failed", {
      sessionId: session.id,
      tutorId: session.tutor_id,
      error: result.error,
    });
    return {
      sent: false,
      warning: `The destination tutor email failed: ${result.error}`,
    };
  }

  return { sent: true };
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
      .select("id, status, student_id, to_session_id, to_cohort_id, from_cohort_id")
      .eq("id", input.requestId)
      .maybeSingle();

    if (requestError || !request) return { error: "Request not found." };
    if (request.status !== "pending") return { error: "Already resolved." };

    if (input.decision === "approved") {
      const fromCohortId = (request.from_cohort_id as string | null) ?? null;
      const toCohortId = (request.to_cohort_id as string | null) ?? null;
      if (fromCohortId && toCohortId) {
        const { data: switchCohorts } = await supabase
          .from("cohorts")
          .select("id, age_group, courses(content_track)")
          .in("id", [fromCohortId, toCohortId]);
        const fromRow = (switchCohorts ?? []).find((row) => row.id === fromCohortId);
        const toRow = (switchCohorts ?? []).find((row) => row.id === toCohortId);
        const course = Array.isArray(fromRow?.courses) ? fromRow?.courses[0] : fromRow?.courses;
        if (
          course?.content_track === KIDS_CONTENT_TRACK &&
          !kidsCohortsShareAgeGroup(fromRow?.age_group, toRow?.age_group)
        ) {
          return { error: KIDS_COHORT_AGE_GROUP_MISMATCH };
        }
      }
    }

    let calendarWarning: string | undefined;
    let invited = false;
    if (input.decision === "approved") {
      const toSessionId = (request.to_session_id as string | null) ?? null;
      const studentId = request.student_id as string;
      const invite = await tryInviteStudentToTargetSession(supabase, {
        toSessionId,
        studentId,
      });
      const tutorNotify = await tryNotifyDestinationTutor(supabase, {
        toSessionId,
        studentId,
        fromCohortId: (request.from_cohort_id as string | null) ?? null,
      });
      invited = invite.invited;
      calendarWarning = [invite.warning, tutorNotify.warning]
        .filter((part): part is string => Boolean(part?.trim()))
        .join(" ");
      if (!calendarWarning) calendarWarning = undefined;
    }

    const responseNote =
      input.adminResponse?.trim() ||
      (input.decision === "approved"
        ? "Your alternate cohort request was approved. Check your calendar for the updated invite."
        : null);

    const nowIso = new Date().toISOString();
    const syncFields =
      input.decision === "approved"
        ? invited
          ? { calendar_synced_at: nowIso, sync_error: null }
          : {
              calendar_synced_at: null,
              sync_error: calendarWarning ?? "Calendar invite failed.",
            }
        : {};

    const { error } = await supabase
      .from("cohort_switch_requests")
      .update({
        status: input.decision,
        tutor_response: responseNote,
        resolved_at: nowIso,
        resolved_by: adminUser.id,
        ...syncFields,
      })
      .eq("id", input.requestId)
      .eq("status", "pending");

    if (error) return { error: error.message };

    revalidatePath(PATH);
    revalidatePath("/admin");
    revalidatePath("/admin/content");
    revalidatePath("/dashboard/schedule");
    revalidatePath("/dashboard/learn");

    if (input.decision === "approved") {
      return {
        success: invited
          ? calendarWarning
            ? `Approved — student invited to the alternate session calendar. ${calendarWarning}`
            : "Approved — student invited to the alternate session calendar."
          : calendarWarning ?? "Approved, but calendar invite failed.",
      };
    }

    return { success: "Request declined." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to resolve request." };
  }
}

function isGroupClassTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  if (normalized.includes("meeting")) return false;
  return normalized.includes("class") || normalized.includes("cohort");
}

export type AdminStudentGroupSessionOption = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  whenLabel: string;
  cohortId: string;
  cohortName: string;
  weekNumber: number | null;
  tutorName: string;
};

export type AdminRescheduleCandidateOption = {
  id: string;
  cohortId: string;
  cohortName: string;
  tutorName: string;
  startsAt: string;
  endsAt: string;
  whenLabel: string;
  weekNumber: number | null;
  memberCount: number;
  capacity: number | null;
  capacityLabel: string;
};

export async function loadAdminStudentGroupSessions(studentId: string): Promise<{
  sessions: AdminStudentGroupSessionOption[];
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    const { data: memberships, error: memberError } = await supabase
      .from("cohort_members")
      .select("cohort_id")
      .eq("user_id", studentId)
      .is("left_at", null);

    if (memberError) return { sessions: [], error: memberError.message };

    const cohortIds = [
      ...new Set((memberships ?? []).map((row) => row.cohort_id as string).filter(Boolean)),
    ];
    if (cohortIds.length === 0) return { sessions: [] };

    const nowIso = new Date().toISOString();
    const { data: sessionRows, error: sessionError } = await supabase
      .from("tutor_scheduled_sessions")
      .select("id, title, starts_at, ends_at, cohort_id, week_number, tutor_id, course_id, status")
      .in("cohort_id", cohortIds)
      .eq("status", "scheduled")
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true });

    if (sessionError) return { sessions: [], error: sessionError.message };

    const classSessions = (sessionRows ?? []).filter(
      (row) => row.cohort_id && isGroupClassTitle(String(row.title ?? ""))
    );
    if (classSessions.length === 0) return { sessions: [] };

    const tutorIds = [...new Set(classSessions.map((row) => row.tutor_id as string).filter(Boolean))];
    const [{ data: cohorts }, { data: tutors }] = await Promise.all([
      supabase.from("cohorts").select("id, name").in("id", cohortIds),
      tutorIds.length > 0
        ? supabase.from("profiles").select("id, full_name, preferred_name").in("id", tutorIds)
        : Promise.resolve({ data: [] }),
    ]);

    const cohortNameById = new Map((cohorts ?? []).map((row) => [row.id as string, row.name as string]));
    const tutorNameById = new Map(
      (tutors ?? []).map((row) => [row.id as string, getDisplayName(row) ?? "Tutor"])
    );

    return {
      sessions: classSessions.map((row) => ({
        id: row.id as string,
        title: row.title as string,
        startsAt: row.starts_at as string,
        endsAt: row.ends_at as string,
        whenLabel: formatSessionWhen(row.starts_at as string, row.ends_at as string),
        cohortId: row.cohort_id as string,
        cohortName: cohortNameById.get(row.cohort_id as string) ?? "Cohort",
        weekNumber: (row.week_number as number | null) ?? null,
        tutorName: tutorNameById.get(row.tutor_id as string) ?? "Tutor",
      })),
    };
  } catch (e) {
    return {
      sessions: [],
      error: e instanceof Error ? e.message : "Failed to load student sessions.",
    };
  }
}

export async function loadAdminRescheduleCandidates(sourceSessionId: string): Promise<{
  candidates: AdminRescheduleCandidateOption[];
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    const { data: source, error: sourceError } = await supabase
      .from("tutor_scheduled_sessions")
      .select("id, course_id, tutor_id, cohort_id, week_number")
      .eq("id", sourceSessionId)
      .maybeSingle();

    if (sourceError || !source?.cohort_id || !source.course_id) {
      return { candidates: [], error: "Source session not found." };
    }

    const options = await loadAlternateCohortSessionsForSource(supabase, {
      id: source.id as string,
      course_id: source.course_id as string,
      tutor_id: source.tutor_id as string,
      cohort_id: source.cohort_id as string,
      week_number: (source.week_number as number | null) ?? null,
    });

    const cohortIds = [...new Set(options.map((option) => option.cohortId))];
    if (cohortIds.length === 0) return { candidates: [] };

    const [{ data: cohortRows }, { data: memberRows }] = await Promise.all([
      supabase.from("cohorts").select("id, capacity").in("id", cohortIds),
      supabase.from("cohort_members").select("cohort_id").in("cohort_id", cohortIds).is("left_at", null),
    ]);

    const capacityById = new Map(
      (cohortRows ?? []).map((row) => [row.id as string, (row.capacity as number | null) ?? null])
    );
    const memberCountById = new Map<string, number>();
    for (const row of memberRows ?? []) {
      const cohortId = row.cohort_id as string;
      memberCountById.set(cohortId, (memberCountById.get(cohortId) ?? 0) + 1);
    }

    return {
      candidates: options.map((option) => {
        const memberCount = memberCountById.get(option.cohortId) ?? 0;
        const capacity = capacityById.get(option.cohortId) ?? null;
        return {
          id: option.id,
          cohortId: option.cohortId,
          cohortName: option.name,
          tutorName: option.tutorName,
          startsAt: option.startsAt,
          endsAt: option.endsAt,
          whenLabel: formatSessionWhen(option.startsAt, option.endsAt),
          weekNumber: option.weekNumber ?? null,
          memberCount,
          capacity,
          capacityLabel: `${memberCount} / ${capacity ?? "—"}`,
        };
      }),
    };
  } catch (e) {
    return {
      candidates: [],
      error: e instanceof Error ? e.message : "Failed to load alternate sessions.",
    };
  }
}

export async function createAdminCohortReschedule(input: {
  studentId: string;
  fromSessionId: string;
  toSessionId: string;
}): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const { createClient } = await import("@/lib/supabase/server");
    const auth = await createClient();
    const {
      data: { user: adminUser },
    } = await auth.auth.getUser();
    if (!adminUser) return { error: "Unauthorized" };

    const studentId = input.studentId.trim();
    const fromSessionId = input.fromSessionId.trim();
    const toSessionId = input.toSessionId.trim();
    if (!studentId || !fromSessionId || !toSessionId) {
      return { error: "Pick a student, the original session, and the target session." };
    }
    if (fromSessionId === toSessionId) {
      return { error: "Pick a different session to move the student to." };
    }

    const { data: membership, error: memberError } = await supabase
      .from("cohort_members")
      .select("cohort_id")
      .eq("user_id", studentId)
      .is("left_at", null);

    if (memberError) return { error: memberError.message };

    const memberCohortIds = new Set(
      (membership ?? []).map((row) => row.cohort_id as string).filter(Boolean)
    );

    const { data: fromSession, error: fromError } = await supabase
      .from("tutor_scheduled_sessions")
      .select("id, title, starts_at, ends_at, cohort_id, course_id, tutor_id, week_number, status")
      .eq("id", fromSessionId)
      .maybeSingle();

    if (fromError || !fromSession?.cohort_id || !fromSession.course_id) {
      return { error: "Original session not found." };
    }
    if (fromSession.status !== "scheduled") {
      return { error: "Original session is no longer scheduled." };
    }
    if (!memberCohortIds.has(fromSession.cohort_id as string)) {
      return { error: "That student is not in the original session's cohort." };
    }
    if (!isGroupClassTitle(String(fromSession.title ?? ""))) {
      return { error: "Original session is not a group class." };
    }

    const candidates = await loadAlternateCohortSessionsForSource(supabase, {
      id: fromSession.id as string,
      course_id: fromSession.course_id as string,
      tutor_id: fromSession.tutor_id as string,
      cohort_id: fromSession.cohort_id as string,
      week_number: (fromSession.week_number as number | null) ?? null,
    });
    const target = candidates.find((option) => option.id === toSessionId);
    if (!target) {
      return { error: "That target session is not a valid same-week alternate." };
    }

    const { data: existing } = await supabase
      .from("cohort_switch_requests")
      .select("id, status")
      .eq("session_id", fromSessionId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (existing) {
      return {
        error: `A reschedule row already exists for this student and session (status: ${existing.status}).`,
      };
    }

    const nowIso = new Date().toISOString();
    const { data: inserted, error: insertError } = await supabase
      .from("cohort_switch_requests")
      .insert({
        session_id: fromSessionId,
        student_id: studentId,
        from_cohort_id: fromSession.cohort_id,
        to_cohort_id: target.cohortId,
        to_session_id: toSessionId,
        message: "Admin-created reschedule (not student-submitted).",
        status: "approved",
        tutor_response: null,
        resolved_at: nowIso,
        resolved_by: adminUser.id,
      })
      .select("id")
      .maybeSingle();

    if (insertError || !inserted) {
      return { error: insertError?.message ?? "Failed to create reschedule." };
    }

    const invite = await tryInviteStudentToTargetSession(supabase, {
      toSessionId,
      studentId,
    });
    const tutorNotify = await tryNotifyDestinationTutor(supabase, {
      toSessionId,
      studentId,
      fromCohortId: fromSession.cohort_id as string,
    });
    const notifyWarning = [invite.warning, tutorNotify.warning]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(" ");
    const { error: syncError } = await supabase
      .from("cohort_switch_requests")
      .update(
        invite.invited
          ? { calendar_synced_at: new Date().toISOString(), sync_error: null }
          : {
              calendar_synced_at: null,
              sync_error: invite.warning ?? "Calendar invite failed.",
            }
      )
      .eq("id", inserted.id);

    if (syncError) return { error: syncError.message };

    const movedSummary = `Your group session has been moved to ${formatSessionWhen(
      target.startsAt,
      target.endsAt
    )} · ${target.name}.`;

    const { data: parentKids } = await supabase
      .from("cohort_members")
      .select("kid_profile_id, kid_profiles!inner(parent_user_id)")
      .eq("cohort_id", fromSession.cohort_id)
      .is("left_at", null)
      .not("kid_profile_id", "is", null);
    const kidMatch = (parentKids ?? []).find((row) => {
      const rel = row.kid_profiles as { parent_user_id?: string } | { parent_user_id?: string }[] | null;
      const parentId = Array.isArray(rel) ? rel[0]?.parent_user_id : rel?.parent_user_id;
      return parentId === studentId;
    });
    const kidProfileId = (kidMatch?.kid_profile_id as string | null) ?? null;

    const { error: notifyError } = await supabase.rpc("notify_student_event_as_staff", {
      p_user_id: studentId,
      p_kid_profile_id: kidProfileId,
      p_type: "cohort_switch_resolved",
      p_actor_user_id: adminUser.id,
      p_payload: {
        session_id: toSessionId,
        request_id: inserted.id,
        status: "approved",
        moved_summary: movedSummary,
      },
    });
    if (notifyError) {
      return {
        error: `Reschedule saved, but the student notification failed: ${notifyError.message}`,
      };
    }

    revalidatePath(PATH);
    revalidatePath("/admin");
    revalidatePath("/dashboard/schedule");
    revalidatePath("/dashboard/learn");

    if (!invite.invited) {
      return {
        success: notifyWarning
          ? `Reschedule recorded. ${notifyWarning}`
          : "Reschedule recorded, but the calendar invite could not be sent.",
      };
    }

    return {
      success: notifyWarning
        ? `Student moved — invited to the new session calendar. ${notifyWarning}`
        : "Student moved — invited to the new session calendar.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create reschedule." };
  }
}
