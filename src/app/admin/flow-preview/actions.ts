"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import { loadAdminMemberDetail } from "@/app/admin/content/member-actions";
import { getCohortSwitchEligibility } from "@/lib/calendar/cohort-switch-policy";
import { loadAlternateCohortSessions } from "@/lib/calendar/load-alternate-cohort-sessions";
import { loadStudentUpcomingSessions } from "@/lib/calendar/load-sessions";
import { getRescheduleEligibility } from "@/lib/calendar/reschedule-policy";
import {
  loadRescheduleSlotsForStudentSession,
  loadRescheduleSlotsForTutorSession,
} from "@/lib/calendar/reschedule-slots";
import { attachLessonLabelsToSessions } from "@/lib/calendar/session-lesson-labels";
import { getDisplayName } from "@/lib/profile/display-name";
import type {
  ScheduledSessionRow,
  StudentScheduledSession,
} from "@/lib/calendar/types";
import type { BookableSlot } from "@/lib/tutoring/availability/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type FlowPreviewEnrollmentOption = {
  key: string;
  label: string;
  courseId: string;
};

export type FlowPreviewStudentContext = {
  userId: string;
  displayName: string;
  email: string | null;
  enrollments: FlowPreviewEnrollmentOption[];
};

async function hydrateSessions(
  supabase: SupabaseClient,
  rows: ScheduledSessionRow[]
): Promise<StudentScheduledSession[]> {
  if (rows.length === 0) return [];

  const labelled = await attachLessonLabelsToSessions(supabase, rows);
  const tutorIds = [...new Set(labelled.map((session) => session.tutor_id))];
  const cohortIds = [
    ...new Set(labelled.map((session) => session.cohort_id).filter((id): id is string => Boolean(id))),
  ];

  const [{ data: tutors }, { data: cohorts }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, preferred_name").in("id", tutorIds),
    cohortIds.length > 0
      ? supabase.from("cohorts").select("id, name").in("id", cohortIds)
      : Promise.resolve({ data: [] }),
  ]);

  const tutorNameById = new Map(
    (tutors ?? []).map((tutor) => [tutor.id as string, getDisplayName(tutor) ?? "Your tutor"])
  );
  const cohortNameById = new Map(
    (cohorts ?? []).map((cohort) => [cohort.id as string, cohort.name as string])
  );

  const groupSessions = labelled.filter(
    (session) => Boolean(session.cohort_id) && Boolean(session.course_id)
  );
  const alternateBySource = await loadAlternateCohortSessions(supabase, groupSessions);

  return labelled.map((session) => {
    const eligibility = getRescheduleEligibility(session, null);
    const alternateCohorts = alternateBySource.get(session.id) ?? [];
    const cohortSwitchEligibility = getCohortSwitchEligibility(
      session,
      null,
      alternateCohorts.length
    );

    return {
      ...session,
      tutorName: tutorNameById.get(session.tutor_id) ?? "Your tutor",
      cohortName: session.cohort_id ? (cohortNameById.get(session.cohort_id) ?? null) : null,
      lessonNumber: session.lessonNumber,
      lessonLabel: session.lessonLabel,
      rescheduleRequest: null,
      canRequestReschedule: eligibility.canRequest,
      rescheduleLockedReason: eligibility.lockedReason,
      isLateCancelReschedule: Boolean(eligibility.isLateCancel),
      cohortSwitchRequest: null,
      canRequestCohortSwitch: cohortSwitchEligibility.canRequest,
      cohortSwitchLockedReason: cohortSwitchEligibility.lockedReason,
      isShortNoticeCohortSwitch: Boolean(cohortSwitchEligibility.isShortNotice),
      alternateCohorts,
    };
  });
}

export async function loadFlowPreviewStudent(
  userId: string
): Promise<{ context?: FlowPreviewStudentContext; error?: string }> {
  try {
    await requireAdminFromActions();
    const { detail, error } = await loadAdminMemberDetail(userId);
    if (error) return { error };
    if (!detail) return { error: "Member not found." };

    const enrollments: FlowPreviewEnrollmentOption[] = [];
    if (detail.foundationalEnrollment && detail.courseIds.foundational) {
      enrollments.push({
        key: "foundational",
        label: "Foundational · 1-to-1",
        courseId: detail.courseIds.foundational,
      });
    }
    if (detail.beginnersEnrollment && detail.courseIds.beginners) {
      const cohort = detail.activeCohorts.find(
        (row) => row.cohortId === detail.beginnersEnrollment?.cohortId
      );
      const mode = detail.beginnersEnrollment.deliveryMode === "group" ? "group" : "1-to-1";
      enrollments.push({
        key: "beginners",
        label: cohort
          ? `Beginners · ${mode} · ${cohort.cohortName}`
          : `Beginners · ${mode}`,
        courseId: detail.courseIds.beginners,
      });
    }
    if (detail.courseIds.community && detail.activeCohorts.length > 0) {
      for (const cohort of detail.activeCohorts) {
        if (enrollments.some((row) => row.label.includes(cohort.cohortName))) continue;
        enrollments.push({
          key: `cohort-${cohort.cohortId}`,
          label: `Active cohort · ${cohort.cohortName}`,
          courseId: detail.courseIds.community,
        });
      }
    }

    return {
      context: {
        userId: detail.userId,
        displayName: detail.displayName,
        email: detail.email,
        enrollments,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load student." };
  }
}

export async function loadFlowPreviewStudentSessions(
  userId: string,
  email: string | null,
  courseId?: string | null
): Promise<{ sessions: StudentScheduledSession[]; error?: string }> {
  try {
    const supabase = await requireAdminFromActions();
    const { sessions } = await loadStudentUpcomingSessions(supabase, userId, email, {
      courseIds: courseId ? [courseId] : undefined,
    });
    return { sessions };
  } catch (e) {
    return {
      sessions: [],
      error: e instanceof Error ? e.message : "Failed to load student sessions.",
    };
  }
}

export async function loadFlowPreviewCohortSessions(
  cohortId: string
): Promise<{ sessions: StudentScheduledSession[]; error?: string }> {
  try {
    const supabase = await requireAdminFromActions();
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("tutor_scheduled_sessions")
      .select("*")
      .eq("cohort_id", cohortId)
      .eq("status", "scheduled")
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(40);

    if (error) return { sessions: [], error: error.message };
    const sessions = await hydrateSessions(supabase, (data ?? []) as ScheduledSessionRow[]);
    return { sessions };
  } catch (e) {
    return {
      sessions: [],
      error: e instanceof Error ? e.message : "Failed to load cohort sessions.",
    };
  }
}

export async function loadFlowPreviewOneToOneSessions(): Promise<{
  sessions: StudentScheduledSession[];
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("tutor_scheduled_sessions")
      .select("*")
      .is("cohort_id", null)
      .eq("status", "scheduled")
      .gte("starts_at", nowIso)
      .not("student_id", "is", null)
      .order("starts_at", { ascending: true })
      .limit(40);

    if (error) return { sessions: [], error: error.message };
    const sessions = await hydrateSessions(supabase, (data ?? []) as ScheduledSessionRow[]);
    return { sessions };
  } catch (e) {
    return {
      sessions: [],
      error: e instanceof Error ? e.message : "Failed to load 1-to-1 sessions.",
    };
  }
}

export async function fetchPreviewRescheduleSlots(
  sessionId: string,
  studentId: string | null
): Promise<{ slots: BookableSlot[]; error?: string }> {
  try {
    const supabase = await requireAdminFromActions();
    if (studentId) {
      return loadRescheduleSlotsForStudentSession(supabase, studentId, sessionId);
    }

    const { data: session, error } = await supabase
      .from("tutor_scheduled_sessions")
      .select("id, tutor_id, starts_at, ends_at, status")
      .eq("id", sessionId)
      .maybeSingle();

    if (error) return { slots: [], error: error.message };
    if (!session) return { slots: [], error: "Lesson not found." };
    if (session.status !== "scheduled") {
      return { slots: [], error: "This lesson is no longer scheduled." };
    }

    return loadRescheduleSlotsForTutorSession(
      supabase,
      session.tutor_id as string,
      session.starts_at as string,
      session.ends_at as string
    );
  } catch (e) {
    return {
      slots: [],
      error: e instanceof Error ? e.message : "Failed to load slots.",
    };
  }
}

