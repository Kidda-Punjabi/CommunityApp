import "server-only";

import { isCountableLessonLogStatus } from "@/lib/lessons/lesson-log-progress";
import type { ScheduledSessionRow } from "@/lib/calendar/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionLessonLabel = {
  lessonNumber: number | null;
  /** e.g. "Lesson 3 — 2 Aug" */
  label: string;
  shortDate: string;
};

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function formatUpcomingLessonLabel(
  lessonNumber: number | null,
  startsAtIso: string
): string {
  const shortDate = formatShortDate(startsAtIso);
  if (lessonNumber == null) return shortDate;
  return `Lesson ${lessonNumber} — ${shortDate}`;
}

/**
 * Derive curriculum lesson numbers for upcoming calendar sessions using the same
 * sequential model as cohort_lesson_log_entries → lessons.lesson_number:
 * completed countable logs = N done → next upcoming session is Lesson N+1.
 */
export async function attachLessonLabelsToSessions<T extends ScheduledSessionRow>(
  supabase: SupabaseClient,
  sessions: T[]
): Promise<Array<T & { lessonNumber: number | null; lessonLabel: string }>> {
  if (sessions.length === 0) return [];

  const cohortIds = [
    ...new Set(sessions.map((s) => s.cohort_id).filter((id): id is string => Boolean(id))),
  ];

  const completedByCohort = new Map<string, number>();

  if (cohortIds.length > 0) {
    const { data: logRows, error } = await supabase
      .from("cohort_lesson_log_entries")
      .select("cohort_id, status")
      .in("cohort_id", cohortIds);

    if (error) throw error;

    for (const row of logRows ?? []) {
      if (!row.cohort_id) continue;
      if (!isCountableLessonLogStatus(row.status as string | null)) continue;
      completedByCohort.set(
        row.cohort_id,
        (completedByCohort.get(row.cohort_id) ?? 0) + 1
      );
    }
  }

  // 1-1: past sessions for the same student/tutor count as completed weeks
  const oneToOneKeys = sessions
    .filter((s) => !s.cohort_id && s.student_id)
    .map((s) => ({ tutorId: s.tutor_id, studentId: s.student_id as string }));

  const completedByOneToOne = new Map<string, number>();
  const uniquePairs = [
    ...new Map(
      oneToOneKeys.map((p) => [`${p.tutorId}:${p.studentId}`, p] as const)
    ).values(),
  ];

  const nowIso = new Date().toISOString();
  await Promise.all(
    uniquePairs.map(async ({ tutorId, studentId }) => {
      const { count, error } = await supabase
        .from("tutor_scheduled_sessions")
        .select("id", { count: "exact", head: true })
        .eq("tutor_id", tutorId)
        .eq("student_id", studentId)
        .neq("status", "cancelled")
        .lt("starts_at", nowIso);
      if (error) throw error;
      completedByOneToOne.set(`${tutorId}:${studentId}`, count ?? 0);
    })
  );

  // Assign sequential numbers within each cohort / 1-1 stream
  const nextIndexByKey = new Map<string, number>();
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  const labelById = new Map<string, { lessonNumber: number | null; lessonLabel: string }>();

  for (const session of sorted) {
    let lessonNumber: number | null = null;
    if (session.cohort_id) {
      const key = `cohort:${session.cohort_id}`;
      const base = completedByCohort.get(session.cohort_id) ?? 0;
      const offset = nextIndexByKey.get(key) ?? 0;
      lessonNumber = base + offset + 1;
      nextIndexByKey.set(key, offset + 1);
    } else if (session.student_id) {
      const key = `1to1:${session.tutor_id}:${session.student_id}`;
      const base = completedByOneToOne.get(`${session.tutor_id}:${session.student_id}`) ?? 0;
      const offset = nextIndexByKey.get(key) ?? 0;
      lessonNumber = base + offset + 1;
      nextIndexByKey.set(key, offset + 1);
    }

    labelById.set(session.id, {
      lessonNumber,
      lessonLabel: formatUpcomingLessonLabel(lessonNumber, session.starts_at),
    });
  }

  return sessions.map((session) => {
    const meta = labelById.get(session.id) ?? {
      lessonNumber: null,
      lessonLabel: formatUpcomingLessonLabel(null, session.starts_at),
    };
    return { ...session, ...meta };
  });
}
