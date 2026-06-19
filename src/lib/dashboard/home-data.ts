import { getDisplayName, getGreetingHeading } from "@/lib/profile/display-name";
import { loadEditableProfile } from "@/lib/profile/load-editable-profile";
import { canAccessEvent, hasAccessToCourse } from "@/lib/membership/access";
import {
  getCourseAccessContext,
  type CourseAccessContext,
} from "@/lib/membership/unlocked";
import {
  splitExpandedEvents,
  type DisplayEvent,
  type StoredEvent,
} from "@/lib/events/recurrence";
import { buildQuizLevelPathway, type QuizProgressRow } from "@/lib/progress/quiz-progress";
import {
  computeStreakPresentation,
  mapStreakRowSnapshot,
  presentationToHomeStats,
} from "@/lib/progress/activity-date";
import { getUserActivityDate } from "@/lib/progress/server-activity-date";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type HomePrimaryCta = {
  label: string;
  href: string;
};

export type HomeContinueItem = {
  type: "lesson" | "quiz" | "flashcard";
  title: string;
  subtitle: string;
  href: string;
  activityAt: string;
};

export type HomeDashboardData = {
  displayName: string | null;
  greetingHeading: string;
  isFreeTier: boolean;
  primaryCta: HomePrimaryCta;
  starterPackHref: string;
  stats: {
    streak: number;
    longestStreak: number;
    redemptionAvailable: boolean;
    streakAtRisk: boolean;
    streakWarning: boolean;
    rescueStreak: number;
    lessonsCompleted: number;
    quizLevelLabel: string;
  };
  continueItem: HomeContinueItem | null;
  hasAnyProgress: boolean;
  showStarterPack: boolean;
  upcomingEvents: DisplayEvent[];
  access: CourseAccessContext;
};

type LessonProgressJoined = {
  lesson_id: string;
  completed: boolean;
  last_position: number;
  seconds_listened: number;
  updated_at: string;
  lessons: {
    id: string;
    title: string;
    lesson_number: number;
    is_free: boolean;
  } | null;
};

type QuizProgressJoined = {
  quiz_id: string;
  completed: boolean;
  score: number | null;
  last_attempted_at: string | null;
  quizzes: {
    id: string;
    title: string;
    level_number: number;
    course_id: string;
  } | null;
};

type FlashcardProgressJoined = {
  flashcard_id: string;
  confidence: string;
  last_reviewed_at: string | null;
  flashcards: {
    id: string;
    lesson_id: string | null;
    deck_id: string | null;
    lessons: {
      id: string;
      title: string;
      lesson_number: number;
    } | null;
  } | null;
};

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function lessonHref(lessonId: string) {
  return `/dashboard/learn/free#lesson-${lessonId}`;
}

function findCurrentQuiz(
  quizzes: { id: string; course_id: string; level_number: number; title: string }[],
  quizProgressMap: Map<string, QuizProgressRow>,
  unlockedCourseIds: Set<string>
) {
  const byCourse = new Map<string, typeof quizzes>();
  for (const quiz of quizzes) {
    const list = byCourse.get(quiz.course_id) ?? [];
    list.push(quiz);
    byCourse.set(quiz.course_id, list);
  }

  for (const [courseId, courseQuizzes] of byCourse) {
    const hasAccess = hasAccessToCourse(unlockedCourseIds, courseId);
    const pathway = buildQuizLevelPathway(courseQuizzes, quizProgressMap, hasAccess);
    const current = pathway.find((level) => level.status === "current");
    if (current) return current;
  }

  return null;
}

function pickContinueItem(
  lessonRows: LessonProgressJoined[],
  quizRows: QuizProgressJoined[],
  flashcardRows: FlashcardProgressJoined[]
): HomeContinueItem | null {
  const candidates: HomeContinueItem[] = [];

  for (const row of lessonRows) {
    const lesson = row.lessons;
    if (!lesson) continue;
    candidates.push({
      type: "lesson",
      title: lesson.title,
      subtitle: `Lesson ${lesson.lesson_number}`,
      href: lessonHref(lesson.id),
      activityAt: row.updated_at,
    });
  }

  for (const row of quizRows) {
    const quiz = row.quizzes;
    if (!quiz || !row.last_attempted_at) continue;
    candidates.push({
      type: "quiz",
      title: quiz.title,
      subtitle: `Level ${quiz.level_number}`,
      href: `/dashboard/practice/quiz/${quiz.id}`,
      activityAt: row.last_attempted_at,
    });
  }

  for (const row of flashcardRows) {
    const flashcard = row.flashcards;
    const lesson = flashcard?.lessons;
    if (!lesson || !row.last_reviewed_at) continue;
    const href =
      flashcard.deck_id != null
        ? `/dashboard/practice/flashcards/${lesson.id}/${flashcard.deck_id}`
        : `/dashboard/practice/flashcards/${lesson.id}`;
    candidates.push({
      type: "flashcard",
      title: lesson.title,
      subtitle: `Flashcards · Lesson ${lesson.lesson_number}`,
      href,
      activityAt: row.last_reviewed_at,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) => new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime()
  );

  return candidates[0];
}

function highestCompletedQuizLevel(quizRows: QuizProgressJoined[]) {
  let maxLevel = 0;
  for (const row of quizRows) {
    if (!row.completed || !row.quizzes) continue;
    maxLevel = Math.max(maxLevel, row.quizzes.level_number);
  }
  return maxLevel > 0 ? `Level ${maxLevel}` : "Level 1";
}

export async function getHomeDashboardData(
  supabase: SupabaseClient,
  user: User
): Promise<HomeDashboardData> {
  const userId = user.id;
  const access = await getCourseAccessContext(supabase, user);

  const activityDate = await getUserActivityDate();

  const { data: streakRow } = await supabase
    .from("user_streaks")
    .select(
      "current_streak, longest_streak, last_activity_date, redemption_available, streak_broken_date, streak_before_break"
    )
    .eq("user_id", userId)
    .maybeSingle();

  const rowSnapshot = streakRow ? mapStreakRowSnapshot(streakRow) : null;
  const presentation = computeStreakPresentation(rowSnapshot, activityDate);
  const streakStats = presentationToHomeStats(presentation);

  const [
    profile,
    { data: lessonProgress },
    { data: quizProgress },
    { data: flashcardProgress },
    { data: freeLessons },
    { data: quizzes },
    { data: events },
  ] = await Promise.all([
    loadEditableProfile(supabase, userId),
    supabase
      .from("lesson_progress")
      .select(
        "lesson_id, completed, last_position, seconds_listened, updated_at, lessons(id, title, lesson_number, is_free)"
      )
      .eq("user_id", userId),
    supabase
      .from("quiz_progress")
      .select(
        "quiz_id, completed, score, last_attempted_at, quizzes(id, title, level_number, course_id)"
      )
      .eq("user_id", userId),
    supabase
      .from("flashcard_progress")
      .select(
        "flashcard_id, confidence, last_reviewed_at, flashcards(id, lesson_id, deck_id, lessons(id, title, lesson_number))"
      )
      .eq("user_id", userId),
    supabase.from("lessons").select("id, is_free").eq("is_free", true),
    supabase.from("quizzes").select("id, course_id, level_number, title"),
    supabase.from("events").select("*").order("starts_at", { ascending: true }),
  ]);

  const lessonRows = (lessonProgress ?? []).map((row) => ({
    ...row,
    lessons: unwrapRelation(row.lessons),
  })) as LessonProgressJoined[];
  const quizRows = (quizProgress ?? []).map((row) => ({
    ...row,
    quizzes: unwrapRelation(row.quizzes),
  })) as QuizProgressJoined[];
  const flashcardRows = (flashcardProgress ?? []).map((row) => {
    const flashcard = unwrapRelation(row.flashcards);
    return {
      ...row,
      flashcards: flashcard
        ? {
            ...flashcard,
            lessons: unwrapRelation(flashcard.lessons),
          }
        : null,
    };
  }) as FlashcardProgressJoined[];

  const displayName = getDisplayName(profile);
  const greetingHeading = getGreetingHeading(displayName);
  const isFreeTier = access.isFreeOnly;

  const lessonsCompleted = lessonRows.filter((row) => row.completed).length;
  const quizProgressMap = new Map<string, QuizProgressRow>(
    quizRows.map((row) => [
      row.quiz_id,
      { quiz_id: row.quiz_id, completed: row.completed, score: row.score },
    ])
  );

  const hasAnyProgress =
    lessonRows.length > 0 ||
    quizRows.length > 0 ||
    flashcardRows.length > 0 ||
    (streakStats.streak ?? 0) > 0 ||
    (presentation.longest_streak ?? 0) > 0;

  const freeLessonIds = (freeLessons ?? []).map((lesson) => lesson.id);
  const completedFreeLessonIds = new Set(
    lessonRows.filter((row) => row.completed).map((row) => row.lesson_id)
  );
  const starterPackCompleted =
    freeLessonIds.length === 0 ||
    freeLessonIds.every((id) => completedFreeLessonIds.has(id));

  const inProgressLesson = [...lessonRows]
    .filter((row) => !row.completed && row.lessons)
    .sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )[0];

  const currentQuiz = findCurrentQuiz(
    quizzes ?? [],
    quizProgressMap,
    access.unlockedCourseIds
  );

  const firstFreeLessonId =
    freeLessonIds.find((id) => !completedFreeLessonIds.has(id)) ?? freeLessonIds[0];
  const starterPackHref = firstFreeLessonId
    ? lessonHref(firstFreeLessonId)
    : "/dashboard/learn";

  let primaryCta: HomePrimaryCta;
  if (inProgressLesson?.lessons) {
    primaryCta = {
      label: `Continue Lesson ${inProgressLesson.lessons.title}`,
      href: lessonHref(inProgressLesson.lessons.id),
    };
  } else if (currentQuiz) {
    primaryCta = {
      label: `Start Level ${currentQuiz.level_number}`,
      href: `/dashboard/practice/quiz/${currentQuiz.id}`,
    };
  } else if (!hasAnyProgress) {
    primaryCta = {
      label: "Start your free lessons",
      href: starterPackHref,
    };
  } else {
    primaryCta = {
      label: "Keep going",
      href: "/dashboard/learn",
    };
  }

  const { upcoming } = splitExpandedEvents((events ?? []) as StoredEvent[]);

  return {
    displayName,
    greetingHeading,
    isFreeTier,
    primaryCta,
    starterPackHref,
    stats: {
      streak: streakStats.streak,
      longestStreak: streakStats.longestStreak,
      redemptionAvailable: streakStats.redemptionAvailable,
      streakAtRisk: streakStats.streakAtRisk,
      streakWarning: streakStats.streakWarning,
      rescueStreak: streakStats.rescueStreak,
      lessonsCompleted,
      quizLevelLabel: highestCompletedQuizLevel(quizRows),
    },
    continueItem: hasAnyProgress
      ? pickContinueItem(lessonRows, quizRows, flashcardRows)
      : null,
    hasAnyProgress,
    showStarterPack: isFreeTier && !starterPackCompleted,
    upcomingEvents: upcoming.slice(0, 2),
    access,
  };
}
