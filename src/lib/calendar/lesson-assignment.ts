export const NEEDS_LESSON_ASSIGNMENT = "needs_assignment" as const;

export type LessonAssignmentStatus = typeof NEEDS_LESSON_ASSIGNMENT;

export type LessonRef = {
  id: string;
  lessonNumber: number;
};

export type LessonAssignmentWrite = {
  lesson_id: string | null;
  week_number: number | null;
  lesson_assignment_status: LessonAssignmentStatus | null;
};

/**
 * Map a calendar occurrence's integer lesson number onto a lessons row.
 * A missing or duplicated lesson_number is needs-assignment, not an unprocessed session.
 */
export function assignmentForLessonNumber(
  lessonNumber: number,
  lessons: LessonRef[]
): LessonAssignmentWrite {
  const matches = lessons.filter((lesson) => lesson.lessonNumber === lessonNumber);
  if (matches.length !== 1) {
    return {
      lesson_id: null,
      week_number: null,
      lesson_assignment_status: NEEDS_LESSON_ASSIGNMENT,
    };
  }

  const lesson = matches[0]!;
  return {
    lesson_id: lesson.id,
    week_number: lesson.lessonNumber,
    lesson_assignment_status: null,
  };
}

export function needsLessonAssignmentWrite(): LessonAssignmentWrite {
  return {
    lesson_id: null,
    week_number: null,
    lesson_assignment_status: NEEDS_LESSON_ASSIGNMENT,
  };
}

export function cohortClassSessionTitle(cohortName: string): string {
  return `Kidda Class - ${cohortName}`;
}

export type LessonSyncSession = {
  id: string;
  lessonId: string | null;
  needsAssignment: boolean;
};

export type LessonSyncLesson = {
  id: string;
  lessonNumber: number;
  title: string;
};

/** Saved assignments stay put. An untouched cohort defaults to calendar order ↔ lesson order. */
export function initialLessonSyncMappings(
  lessons: LessonSyncLesson[],
  sessions: LessonSyncSession[]
): Array<{ sessionId: string; lessonId: string | null }> {
  const processed = sessions.some((session) => session.lessonId != null || session.needsAssignment);
  if (processed) {
    return sessions.map((session) => ({
      sessionId: session.id,
      lessonId: session.lessonId,
    }));
  }

  return sessions.map((session, index) => ({
    sessionId: session.id,
    lessonId: lessons[index]?.id ?? null,
  }));
}

export function lessonSyncStateFromSessions(
  sessions: Array<{ lessonId: string | null; needsAssignment: boolean }>
): "synced" | "needs_assignment" | "none" {
  if (sessions.length === 0) return "none";
  if (sessions.some((session) => session.needsAssignment)) return "needs_assignment";
  if (sessions.every((session) => session.lessonId != null)) return "synced";
  return "none";
}

/** Log-based week refresh must not overwrite an explicit lesson assignment or a calendar_link row. */
export function sessionWeekNumberIsFrozen(session: {
  lesson_id?: string | null;
  match_method?: string | null;
}): boolean {
  return session.lesson_id != null || session.match_method === "calendar_link";
}
