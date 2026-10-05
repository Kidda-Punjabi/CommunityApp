import { canAccessLesson, type PaidCourseTier } from "@/lib/membership/access";
import { isPublicLearnCourse } from "@/lib/membership/courses";

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
};

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
        label: deck.weekNumber == null ? "Other decks" : `Week ${deck.weekNumber}`,
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

/**
 * Lessons this student has been taught.
 * Live courses use cohort_lesson_unlocks (group) or student_lesson_unlocks (1:1).
 * Community, and private courses with no enrollment row, follow course access.
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
      if (
        course &&
        !isPublicLearnCourse({
          id: course.id,
          name: course.name,
          required_tier: course.requiredTier,
          is_public: course.isPublic,
        })
      ) {
        taught.add(lesson.id);
      }
      continue;
    }

    const unlockedByCohort = enrollments.some(
      (enrollment) =>
        enrollment.deliveryMode === "group" &&
        Boolean(enrollment.cohortId) &&
        cohortUnlockKeys.has(`${enrollment.cohortId}:${lesson.id}`)
    );
    const hasIndividualEnrollment = enrollments.some(
      (enrollment) => enrollment.deliveryMode !== "group"
    );
    if (
      unlockedByCohort ||
      (hasIndividualEnrollment && input.studentUnlockLessonIds.has(lesson.id))
    ) {
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
}): GameDeckSummary[] {
  const lessonsById = new Map(input.lessons.map((lesson) => [lesson.id, lesson]));
  const setsById = new Map(input.sets.map((set) => [set.id, set]));
  const seen = new Set<string>();
  const decks: GameDeckSummary[] = [];

  for (const link of input.links) {
    if (!link.lessonId) continue;
    const lesson = lessonsById.get(link.lessonId);
    const set = setsById.get(link.deckId);
    if (!lesson || !set || set.cardCount <= 0) continue;
    if (!input.taughtLessonIds.has(lesson.id)) continue;
    if (
      !canAccessLesson(input.unlockedCourseIds, {
        is_free: lesson.isFree,
        course_id: lesson.courseId,
      })
    ) {
      continue;
    }
    if (input.englishCourseIds) {
      if (!input.englishCourseIds.has(lesson.courseId)) continue;
    } else if (!lesson.isPublicCourse) {
      continue;
    }

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

  decks.sort(compareGameDecks);
  return decks;
}
