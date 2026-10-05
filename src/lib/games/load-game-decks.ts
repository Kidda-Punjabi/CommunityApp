import type { SupabaseClient, User } from "@supabase/supabase-js";
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import type { PaidCourseTier } from "@/lib/membership/access";
import { isPublicLearnCourse, type CourseRecord } from "@/lib/membership/courses";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { resolveGamesContentScope } from "@/lib/games/content-scope";
import { actorFilter, resolveCourseActor, studentActorFilter } from "@/lib/kids/course-actor";
import {
  buildGameDeckSummaries,
  lessonIdsTaughtToStudent,
  type DeckListLesson,
  type DeckListLink,
  type DeckListSet,
  type GameDeckSummary,
  type TaughtCourseInput,
  type TaughtEnrollmentInput,
  type TaughtLessonInput,
} from "@/lib/games/game-deck-weeks";

export type { GameDeckSummary };

type LessonQueryRow = {
  id: string;
  course_id: string;
  lesson_number: number;
  title: string | null;
  is_free: boolean | null;
  courses:
    | {
        name: string | null;
        required_tier: string | null;
        is_public: boolean | null;
      }
    | {
        name: string | null;
        required_tier: string | null;
        is_public: boolean | null;
      }[]
    | null;
};

type SetCountRow = {
  id: string;
  name: string;
  week_number: number | null;
  flashcards: { count: number }[] | { count: number } | null;
};

function assertQuery<T>(label: string, result: { data: T; error: { message: string } | null }): T {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data;
}

function courseFromLesson(row: LessonQueryRow) {
  const course = Array.isArray(row.courses) ? row.courses[0] : row.courses;
  return {
    name: course?.name ?? "Course",
    required_tier: course?.required_tier ?? null,
    is_public: course?.is_public ?? null,
  };
}

function embeddedCardCount(value: SetCountRow["flashcards"]): number {
  if (!value) return 0;
  const row = Array.isArray(value) ? value[0] : value;
  return typeof row?.count === "number" ? row.count : 0;
}

export async function loadAccessibleGameDecks(
  supabase: SupabaseClient,
  user: User
): Promise<GameDeckSummary[]> {
  const actor = await resolveCourseActor(supabase, user.id);
  const enrollmentFilter = actorFilter(actor);

  const [lessonResult, linkResult, setResult, access, scope, enrollmentResult, isAdmin] =
    await Promise.all([
      supabase
        .from("lessons")
        .select("id, course_id, lesson_number, title, is_free, courses(name, required_tier, is_public)"),
      supabase.from("set_course_links").select("deck_id, lesson_id, course_id"),
      supabase.from("flashcard_sets").select("id, name, week_number, flashcards(count)"),
      getCourseAccessContext(supabase, user),
      resolveGamesContentScope(supabase, user.id),
      supabase
        .from("course_enrollments")
        .select("course_id, delivery_mode, cohort_id")
        .eq(enrollmentFilter.column, enrollmentFilter.value),
      actor.kind === "user" ? canAccessAdminPanel(user, supabase) : Promise.resolve(false),
    ]);

  const lessonRows = (assertQuery("lessons", lessonResult) ?? []) as LessonQueryRow[];
  const linkRows = assertQuery("set_course_links", linkResult) ?? [];
  const setRows = (assertQuery("flashcard_sets", setResult) ?? []) as SetCountRow[];
  const enrollmentRows = assertQuery("course_enrollments", enrollmentResult) ?? [];

  const lessons: DeckListLesson[] = lessonRows.map((row) => {
    const course = courseFromLesson(row);
    const courseRecord: CourseRecord = {
      id: row.course_id,
      name: course.name,
      required_tier: course.required_tier,
      is_public: course.is_public,
    };
    return {
      id: row.id,
      courseId: row.course_id,
      lessonNumber: row.lesson_number,
      title: row.title ?? "Lesson",
      isFree: Boolean(row.is_free),
      courseName: course.name,
      courseTier: (course.required_tier as PaidCourseTier | null) ?? null,
      isPublicCourse: isPublicLearnCourse(courseRecord),
    };
  });

  const courses: TaughtCourseInput[] = access.courses.map((course) => ({
    id: course.id,
    name: course.name,
    requiredTier: course.required_tier ?? null,
    isPublic: course.is_public ?? null,
  }));

  const enrollments: TaughtEnrollmentInput[] = enrollmentRows
    .filter((row) => row.course_id)
    .map((row) => ({
      courseId: row.course_id as string,
      deliveryMode: (row.delivery_mode as string | null) ?? null,
      cohortId: (row.cohort_id as string | null) ?? null,
    }));

  const enrolledCourseIds = new Set(enrollments.map((enrollment) => enrollment.courseId));
  const adminPreviewCourseIds = new Set<string>();
  if (isAdmin) {
    for (const course of courses) {
      if (!enrolledCourseIds.has(course.id)) adminPreviewCourseIds.add(course.id);
    }
  }

  const cohortIds = [
    ...new Set(
      enrollments
        .filter((enrollment) => enrollment.deliveryMode === "group" && enrollment.cohortId)
        .map((enrollment) => enrollment.cohortId as string)
    ),
  ];
  const lessonIds = lessons.map((lesson) => lesson.id);
  const unlockFilter = studentActorFilter(actor);

  const [cohortUnlockResult, studentUnlockResult] = await Promise.all([
    cohortIds.length > 0 && lessonIds.length > 0
      ? supabase
          .from("cohort_lesson_unlocks")
          .select("cohort_id, lesson_id")
          .in("cohort_id", cohortIds)
          .in("lesson_id", lessonIds)
      : Promise.resolve({ data: [], error: null }),
    lessonIds.length > 0
      ? supabase
          .from("student_lesson_unlocks")
          .select("lesson_id")
          .eq(unlockFilter.column, unlockFilter.value)
          .in("lesson_id", lessonIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const cohortUnlockRows = assertQuery("cohort_lesson_unlocks", cohortUnlockResult) ?? [];
  const studentUnlockRows = assertQuery("student_lesson_unlocks", studentUnlockResult) ?? [];

  const taughtLessons: TaughtLessonInput[] = lessons.map((lesson) => ({
    id: lesson.id,
    courseId: lesson.courseId,
    isFree: lesson.isFree,
  }));

  const taughtLessonIds = lessonIdsTaughtToStudent({
    lessons: taughtLessons,
    courses,
    enrollments,
    cohortUnlocks: cohortUnlockRows
      .filter((row) => row.cohort_id && row.lesson_id)
      .map((row) => ({
        cohortId: row.cohort_id as string,
        lessonId: row.lesson_id as string,
      })),
    studentUnlockLessonIds: new Set(
      studentUnlockRows
        .map((row) => row.lesson_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
    adminPreviewCourseIds,
  });

  const links: DeckListLink[] = linkRows.map((row) => ({
    deckId: row.deck_id as string,
    lessonId: (row.lesson_id as string | null) ?? null,
  }));

  const sets: DeckListSet[] = setRows.map((row) => ({
    id: row.id,
    name: row.name,
    weekNumber: row.week_number,
    cardCount: embeddedCardCount(row.flashcards),
  }));

  return buildGameDeckSummaries({
    lessons,
    links,
    sets,
    unlockedCourseIds: access.unlockedCourseIds,
    taughtLessonIds,
    englishCourseIds: scope.mode === "english" ? new Set(scope.courseIds) : null,
  });
}
