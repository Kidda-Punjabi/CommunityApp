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

function oneToOneStreamKey(session: ScheduledSessionRow): string | null {
  if (!session.student_id) return null;
  if (session.google_recurring_event_id) {
    return `series:${session.tutor_id}:${session.student_id}:${session.google_recurring_event_id}`;
  }
  if (session.course_id) {
    return `course:${session.tutor_id}:${session.student_id}:${session.course_id}`;
  }
  return `session:${session.id}`;
}

async function loadOneToOneLessonNumbersBySessionId(
  supabase: SupabaseClient,
  sessions: ScheduledSessionRow[]
): Promise<Map<string, number>> {
  const lessonNumberBySessionId = new Map<string, number>();
  const uniqueStreams = [
    ...new Map(
      sessions
        .filter((session) => !session.cohort_id && session.student_id)
        .map((session) => {
          const key = oneToOneStreamKey(session);
          return key ? ([key, session] as const) : null;
        })
        .filter((entry): entry is readonly [string, ScheduledSessionRow] => entry != null)
    ).values(),
  ];

  await Promise.all(
    uniqueStreams.map(async (sample) => {
      const studentId = sample.student_id as string;
      let data: Array<{ id: string }> | null = null;
      let error: { message: string } | null = null;

      if (sample.google_recurring_event_id) {
        ({ data, error } = await supabase
          .from("tutor_scheduled_sessions")
          .select("id, starts_at")
          .eq("tutor_id", sample.tutor_id)
          .eq("student_id", studentId)
          .eq("google_recurring_event_id", sample.google_recurring_event_id)
          .neq("status", "cancelled")
          .neq("match_method", "unmatched")
          .neq("match_method", "title_name")
          .order("starts_at", { ascending: true }));
      } else if (sample.course_id) {
        ({ data, error } = await supabase
          .from("tutor_scheduled_sessions")
          .select("id, starts_at")
          .eq("tutor_id", sample.tutor_id)
          .eq("student_id", studentId)
          .eq("course_id", sample.course_id)
          .is("google_recurring_event_id", null)
          .neq("status", "cancelled")
          .neq("match_method", "unmatched")
          .neq("match_method", "title_name")
          .order("starts_at", { ascending: true }));
      } else {
        return;
      }

      if (error) throw error;

      for (const [index, row] of (data ?? []).entries()) {
        lessonNumberBySessionId.set(row.id, index + 1);
      }
    })
  );

  return lessonNumberBySessionId;
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

  const oneToOneLessonNumberBySessionId = await loadOneToOneLessonNumbersBySessionId(
    supabase,
    sessions
  );

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
      lessonNumber = oneToOneLessonNumberBySessionId.get(session.id) ?? null;
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
