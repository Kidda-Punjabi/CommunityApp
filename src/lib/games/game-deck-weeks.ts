import { canAccessLesson, type PaidCourseTier } from "@/lib/membership/access";

export type GameDeckSummary = {
  lessonId: string;
  deckId: string;
  setName: string;
  courseName: string;
  courseTier: PaidCourseTier | null;
  lessonTitle: string;
  cardCount: number;
  /** flashcard_sets.week_number, or the linked lesson number when the set has none. */
  weekNumber: number | null;
};

export type TaughtLessonInput = {
  id: string;
  courseId: string;
  isFree: boolean;
};

export type TaughtCourseInput = {
  id: string;
  name: string;
  requiredTier: string | null;
  isPublic: boolean | null;
};

export type TaughtEnrollmentInput = {
  courseId: string;
  deliveryMode: string | null;
  cohortId: string | null;
  /** cohorts.status. Finished cohorts do not restrict weeks. */
  cohortStatus?: string | null;
  /** 1:1 package is finished or withdrawn, so old unlocks should not hide weeks. */
  individualPackageInactive?: boolean;
};

/** Cohort / package-instance statuses that mean the run is over. */
export const FINISHED_RUN_STATUSES = new Set(["classes_completed", "offboarding_complete"]);

export function isFinishedRunStatus(status: string | null | undefined): boolean {
  return FINISHED_RUN_STATUSES.has((status ?? "").toLowerCase());
}

export const EXTRA_PRACTICE_LABEL = "Extra practice";

export type DeckListLesson = {
  id: string;
  courseId: string;
  lessonNumber: number;
  title: string;
  isFree: boolean;
  courseName: string;
  courseTier: PaidCourseTier | null;
  isPublicCourse: boolean;
};

export type DeckListLink = {
  deckId: string;
  lessonId: string | null;
  courseId?: string | null;
};

export type DeckListSet = {
  id: string;
  name: string;
  weekNumber: number | null;
  cardCount: number;
};

/** Prefer the set's week. Fall back to the linked lesson number. */
export function resolveDeckWeekNumber(
  setWeekNumber: number | null | undefined,
  lessonNumber: number | null | undefined
): number | null {
  if (typeof setWeekNumber === "number" && Number.isFinite(setWeekNumber)) {
    return setWeekNumber;
  }
  if (typeof lessonNumber === "number" && Number.isFinite(lessonNumber)) {
    return lessonNumber;
  }
  return null;
}

function weekSortKey(weekNumber: number | null): number {
  return weekNumber == null ? Number.POSITIVE_INFINITY : weekNumber;
}

export function compareGameDecks(a: GameDeckSummary, b: GameDeckSummary): number {
  const byWeek = weekSortKey(a.weekNumber) - weekSortKey(b.weekNumber);
  if (byWeek !== 0) return byWeek;
  return a.setName.localeCompare(b.setName, undefined, { sensitivity: "base" });
}

export function sortedWeekNumbers(decks: GameDeckSummary[]): number[] {
  return [
    ...new Set(
      decks
        .map((deck) => deck.weekNumber)
        .filter((week): week is number => week != null)
    ),
  ].sort((a, b) => a - b);
}

/** One specific week. There is no all-weeks option. */
export function decksForWeek(decks: GameDeckSummary[], weekNumber: number): GameDeckSummary[] {
  return decks.filter((deck) => deck.weekNumber === weekNumber);
}

export function groupDecksByWeek(
  decks: GameDeckSummary[]
): { weekNumber: number | null; label: string; decks: GameDeckSummary[] }[] {
  const groups: { weekNumber: number | null; label: string; decks: GameDeckSummary[] }[] = [];

  for (const deck of [...decks].sort(compareGameDecks)) {
    const last = groups[groups.length - 1];
    if (!last || last.weekNumber !== deck.weekNumber) {
      groups.push({
        weekNumber: deck.weekNumber,
        label: deck.weekNumber == null ? EXTRA_PRACTICE_LABEL : `Week ${deck.weekNumber}`,
        decks: [deck],
      });
      continue;
    }
    last.decks.push(deck);
  }

  return groups;
}

function isCommunityCourse(course: TaughtCourseInput): boolean {
  if ((course.requiredTier ?? "").toLowerCase() === "community") return true;
  return course.name.toLowerCase().includes("community");
}

function cohortHasUnlockRows(
  cohortId: string,
  cohortUnlocks: { cohortId: string; lessonId: string }[]
): boolean {
  return cohortUnlocks.some((row) => row.cohortId === cohortId);
}

/**
 * Restrict weeks only for a live run that actually has unlock rows.
 * Finished cohorts, missing enrollments, and runs with zero unlocks stay open.
 */
function enrollmentRestrictsWeeks(
  enrollment: TaughtEnrollmentInput,
  cohortUnlocks: { cohortId: string; lessonId: string }[],
  coursesWithStudentUnlocks: Set<string>
): boolean {
  if (enrollment.deliveryMode === "group" && enrollment.cohortId) {
    if (isFinishedRunStatus(enrollment.cohortStatus)) return false;
    return cohortHasUnlockRows(enrollment.cohortId, cohortUnlocks);
  }

  if (enrollment.individualPackageInactive) return false;
  return coursesWithStudentUnlocks.has(enrollment.courseId);
}

/**
 * Lessons this student has been taught.
 * The unlock filter applies only while they are in an active cohort or 1:1
 * package that has unlock records. Community, finished runs, and course access
 * with no unlock rows show every lesson.
 */
export function lessonIdsTaughtToStudent(input: {
  lessons: TaughtLessonInput[];
  courses: TaughtCourseInput[];
  enrollments: TaughtEnrollmentInput[];
  cohortUnlocks: { cohortId: string; lessonId: string }[];
  studentUnlockLessonIds: Set<string>;
  adminPreviewCourseIds: Set<string>;
}): Set<string> {
  const coursesById = new Map(input.courses.map((course) => [course.id, course]));
  const enrollmentsByCourse = new Map<string, TaughtEnrollmentInput[]>();
  for (const enrollment of input.enrollments) {
    const list = enrollmentsByCourse.get(enrollment.courseId) ?? [];
    list.push(enrollment);
    enrollmentsByCourse.set(enrollment.courseId, list);
  }

  const coursesWithStudentUnlocks = new Set(
    input.lessons
      .filter((lesson) => input.studentUnlockLessonIds.has(lesson.id))
      .map((lesson) => lesson.courseId)
  );
  const cohortUnlockKeys = new Set(
    input.cohortUnlocks.map((row) => `${row.cohortId}:${row.lessonId}`)
  );
  const taught = new Set<string>();

  for (const lesson of input.lessons) {
    if (lesson.isFree || input.adminPreviewCourseIds.has(lesson.courseId)) {
      taught.add(lesson.id);
      continue;
    }

    const course = coursesById.get(lesson.courseId);
    if (course && isCommunityCourse(course)) {
      taught.add(lesson.id);
      continue;
    }

    const enrollments = enrollmentsByCourse.get(lesson.courseId) ?? [];
    if (enrollments.length === 0) {
      taught.add(lesson.id);
      continue;
    }

    const restricting = enrollments.filter((enrollment) =>
      enrollmentRestrictsWeeks(enrollment, input.cohortUnlocks, coursesWithStudentUnlocks)
    );
    if (restricting.length === 0) {
      taught.add(lesson.id);
      continue;
    }

    const unlockedByCohort = restricting.some(
      (enrollment) =>
        enrollment.deliveryMode === "group" &&
        Boolean(enrollment.cohortId) &&
        cohortUnlockKeys.has(`${enrollment.cohortId}:${lesson.id}`)
    );
    const unlockedIndividually = restricting.some(
      (enrollment) =>
        enrollment.deliveryMode !== "group" && input.studentUnlockLessonIds.has(lesson.id)
    );
    if (unlockedByCohort || unlockedIndividually) {
      taught.add(lesson.id);
    }
  }

  return taught;
}

export function buildGameDeckSummaries(input: {
  lessons: DeckListLesson[];
  links: DeckListLink[];
  sets: DeckListSet[];
  unlockedCourseIds: Set<string>;
  taughtLessonIds: Set<string>;
  /** When set, only these courses (Learn English). Otherwise public courses only. */
  englishCourseIds: Set<string> | null;
  /** Kid sessions include these private courses (Kids Beginners). */
  privateCourseIds?: Set<string> | null;
}): GameDeckSummary[] {
  const lessonsById = new Map(input.lessons.map((lesson) => [lesson.id, lesson]));
  const setsById = new Map(input.sets.map((set) => [set.id, set]));
  const seen = new Set<string>();
  const decks: GameDeckSummary[] = [];

  function lessonInScope(lesson: DeckListLesson): boolean {
    if (
      !canAccessLesson(input.unlockedCourseIds, {
        is_free: lesson.isFree,
        course_id: lesson.courseId,
      })
    ) {
      return false;
    }
    if (input.englishCourseIds) return input.englishCourseIds.has(lesson.courseId);
    if (lesson.isPublicCourse) return true;
    return Boolean(input.privateCourseIds?.has(lesson.courseId));
  }

  for (const link of input.links) {
    if (!link.lessonId) continue;
    const lesson = lessonsById.get(link.lessonId);
    const set = setsById.get(link.deckId);
    if (!lesson || !set || set.cardCount <= 0) continue;
    if (!input.taughtLessonIds.has(lesson.id)) continue;
    if (!lessonInScope(lesson)) continue;

    const key = `${lesson.id}:${set.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    decks.push({
      lessonId: lesson.id,
      deckId: set.id,
      setName: set.name,
      courseName: lesson.courseName,
      courseTier: lesson.courseTier,
      lessonTitle: lesson.title,
      cardCount: set.cardCount,
      weekNumber: resolveDeckWeekNumber(set.weekNumber, lesson.lessonNumber),
    });
  }

  const lessonLinkedDeckIds = new Set(
    input.links.filter((link) => link.lessonId).map((link) => link.deckId)
  );
  const lessonsByCourse = new Map<string, DeckListLesson[]>();
  for (const lesson of input.lessons) {
    const list = lessonsByCourse.get(lesson.courseId) ?? [];
    list.push(lesson);
    lessonsByCourse.set(lesson.courseId, list);
  }

  for (const link of input.links) {
    if (link.lessonId || !link.courseId) continue;
    if (lessonLinkedDeckIds.has(link.deckId)) continue;
    const set = setsById.get(link.deckId);
    if (!set || set.cardCount <= 0) continue;

    const anchor = (lessonsByCourse.get(link.courseId) ?? [])
      .filter((lesson) => lessonInScope(lesson))
      .sort((a, b) => a.lessonNumber - b.lessonNumber)[0];
    if (!anchor) continue;

    const key = `extra:${link.courseId}:${set.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    decks.push({
      lessonId: anchor.id,
      deckId: set.id,
      setName: set.name,
      courseName: anchor.courseName,
      courseTier: anchor.courseTier,
      lessonTitle: EXTRA_PRACTICE_LABEL,
      cardCount: set.cardCount,
      weekNumber: set.weekNumber,
    });
  }

  decks.sort(compareGameDecks);
  return decks;
}
