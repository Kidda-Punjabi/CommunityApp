import { getDisplayName } from "@/lib/profile/display-name";
import { loadEditableProfile } from "@/lib/profile/load-editable-profile";
import { getCourseRequiredTier, hasAccessToCourse } from "@/lib/membership/access";
import {
  formatMembersStudiedTodayLabel,
  loadMembersStudiedToday,
} from "@/lib/leaderboard/load-members-studied-today";
import {
  getCourseAccessContext,
  type CourseAccessContext,
} from "@/lib/membership/unlocked";
import { findCoursesForTier } from "@/lib/membership/courses";
import {
  splitExpandedEvents,
  type DisplayEvent,
  type StoredEvent,
} from "@/lib/events/recurrence";
import {
  canAccessLessonInContext,
  isLessonContentUnlockedForUser,
} from "@/lib/learning/learn-access";
import { isPrivateAccessCourse } from "@/lib/learning/private-courses";
import {
  learnTrackPath,
  type LearnTrackId,
} from "@/lib/learning/learn-catalog";
import { buildQuizLevelPathway, isQuizPassing, type QuizProgressRow } from "@/lib/progress/quiz-progress";
import {
  fetchLessonCompletionMap,
  type LessonCompletionStatus,
} from "@/lib/progress/lesson-completion";
import {
  computeStreakPresentation,
  mapStreakRowSnapshot,
  presentationToHomeStats,
} from "@/lib/progress/activity-date";
import { getUserActivityDate } from "@/lib/progress/server-activity-date";
import { fetchLessonContentUnlockMap } from "@/lib/tutoring/lesson-content-access";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type HomePrimaryCta = {
  label: string;
  href: string;
};

export type HomeMotivationData = {
  studiedToday: boolean;
};

export type HomeDashboardData = {
  displayName: string | null;
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
    quizzesPassed: number;
  };
  hasAnyProgress: boolean;
  showStarterPack: boolean;
  showLiveTranslate: boolean;
  showPhotoTranslate: boolean;
  upcomingEvents: DisplayEvent[];
  access: CourseAccessContext;
  motivation: HomeMotivationData;
  membersStudiedTodayLabel: string | null;
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

type HomeLessonRef = {
  id: string;
  course_id: string;
  lesson_number: number;
  title: string;
  is_free: boolean;
  pdf_url?: string | null;
  audio_url?: string | null;
};

const CURRICULUM_TRACK_ORDER: LearnTrackId[] = [
  "free",
  "foundational",
  "beginners",
  "community",
];

function lessonLearnHref(lessonId: string, trackId: LearnTrackId) {
  return `${learnTrackPath(trackId)}#lesson-${lessonId}`;
}

function trackIdForLesson(
  lesson: HomeLessonRef,
  access: CourseAccessContext
): LearnTrackId | null {
  if (lesson.is_free) return "free";

  const course = access.courses.find((item) => item.id === lesson.course_id);
  if (!course) return "free";
  if (course.is_public === false || course.required_tier?.toLowerCase() === "private") {
    return null; // Private courses (English) are in a separate section now
  }

  return getCourseRequiredTier(course);
}

function lessonsInCurriculumOrder(
  lessons: HomeLessonRef[],
  access: CourseAccessContext
): HomeLessonRef[] {
  const ordered: HomeLessonRef[] = [];

  for (const trackId of CURRICULUM_TRACK_ORDER) {
    if (trackId === "free") {
      ordered.push(
        ...lessons
          .filter((lesson) => lesson.is_free)
          .sort((a, b) => a.lesson_number - b.lesson_number)
      );
      continue;
    }

    const courseIds = new Set(
      findCoursesForTier(access.courses, trackId).map((course) => course.id)
    );

    ordered.push(
      ...lessons
        .filter((lesson) => courseIds.has(lesson.course_id) && !lesson.is_free)
        .sort((a, b) => a.lesson_number - b.lesson_number)
    );
  }

  return ordered;
}

function lessonUnitLabel(trackId: LearnTrackId) {
  return trackId === "community" ? "Week" : "Lesson";
}

function findNextLesson(
  lessons: HomeLessonRef[],
  access: CourseAccessContext,
  completionMap: Map<string, LessonCompletionStatus>,
  contentUnlockedMap: Map<string, boolean>
): { lesson: HomeLessonRef; trackId: LearnTrackId } | null {
  for (const lesson of lessonsInCurriculumOrder(lessons, access)) {
    if (!canAccessLessonInContext(access, lesson)) continue;
    if (
      !isLessonContentUnlockedForUser(
        access,
        lesson,
        contentUnlockedMap.get(lesson.id)
      )
    ) {
      continue;
    }

    if (completionMap.get(lesson.id)?.fullyComplete) continue;

    const trackId = trackIdForLesson(lesson, access);
    if (!trackId) continue; // Skip private/English lessons

    return { lesson, trackId };
  }

  return null;
}

function starterPackLessonHref(lessonId: string) {
  return lessonLearnHref(lessonId, "free");
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

function countAccessibleLessonsCompleted(
  lessons: HomeLessonRef[],
  access: CourseAccessContext,
  completionMap: Map<string, LessonCompletionStatus>,
  contentUnlockedMap: Map<string, boolean>
): number {
  return lessons.filter((lesson) => {
    // English / private courses keep their own stats — exclude from Punjabi home.
    if (isPrivateAccessCourse(access, lesson.course_id)) return false;
    if (!canAccessLessonInContext(access, lesson)) return false;
    if (
      !isLessonContentUnlockedForUser(
        access,
        lesson,
        contentUnlockedMap.get(lesson.id)
      )
    ) {
      return false;
    }
    return completionMap.get(lesson.id)?.fullyComplete ?? false;
  }).length;
}

function countQuizzesPassed(
  quizRows: QuizProgressJoined[],
  access: CourseAccessContext,
  questionCountByQuizId: Map<string, number>
): number {
  let passed = 0;

  for (const row of quizRows) {
    const quiz = row.quizzes;
    if (!quiz) continue;
    if (isPrivateAccessCourse(access, quiz.course_id)) continue;
    if (!hasAccessToCourse(access.unlockedCourseIds, quiz.course_id)) continue;

    if (
      isQuizPassing(
        { completed: row.completed, score: row.score },
        questionCountByQuizId.get(quiz.id) ?? 0
      )
    ) {
      passed++;
    }
  }

  return passed;
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
    { data: allLessons },
    { data: quizzes },
    { data: quizQuestions },
    { data: events },
    membersStudiedToday,
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
    supabase
      .from("lessons")
      .select("id, course_id, lesson_number, title, is_free, pdf_url, audio_url")
      .order("lesson_number"),
    supabase.from("quizzes").select("id, course_id, level_number, title"),
    supabase.from("quiz_questions").select("quiz_id"),
    supabase.from("events").select("*").order("starts_at", { ascending: true }),
    loadMembersStudiedToday(supabase, activityDate),
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
  const isFreeTier = access.isFreeOnly;
  const studiedToday = presentation.day_gap === 0;

  const quizProgressMap = new Map<string, QuizProgressRow>(
    quizRows.map((row) => [
      row.quiz_id,
      { quiz_id: row.quiz_id, completed: row.completed, score: row.score },
    ])
  );

  const lessonCatalog = (allLessons ?? []) as HomeLessonRef[];
  const privateLessonIds = new Set(
    lessonCatalog
      .filter((lesson) => isPrivateAccessCourse(access, lesson.course_id))
      .map((lesson) => lesson.id)
  );

  const hasPunjabiLessonProgress = lessonRows.some(
    (row) => !privateLessonIds.has(row.lesson_id)
  );
  const hasPunjabiQuizProgress = quizRows.some((row) => {
    const courseId = row.quizzes?.course_id;
    return courseId != null && !isPrivateAccessCourse(access, courseId);
  });
  const hasPunjabiFlashcardProgress = flashcardRows.some((row) => {
    const lessonId = row.flashcards?.lesson_id;
    return lessonId != null && !privateLessonIds.has(lessonId);
  });

  const hasAnyProgress =
    hasPunjabiLessonProgress ||
    hasPunjabiQuizProgress ||
    hasPunjabiFlashcardProgress ||
    (streakStats.streak ?? 0) > 0 ||
    (presentation.longest_streak ?? 0) > 0;

  const [completionMap, contentUnlockedMap] = await Promise.all([
    fetchLessonCompletionMap(supabase, userId, lessonCatalog),
    fetchLessonContentUnlockMap(supabase, userId, lessonCatalog, access),
  ]);

  const questionCountByQuizId = new Map<string, number>();
  for (const row of quizQuestions ?? []) {
    questionCountByQuizId.set(
      row.quiz_id,
      (questionCountByQuizId.get(row.quiz_id) ?? 0) + 1
    );
  }

  const lessonsCompleted = countAccessibleLessonsCompleted(
    lessonCatalog,
    access,
    completionMap,
    contentUnlockedMap
  );
  const quizzesPassed = countQuizzesPassed(
    quizRows,
    access,
    questionCountByQuizId
  );

  const freeLessonIds = (freeLessons ?? []).map((lesson) => lesson.id);
  const completedFreeLessonIds = new Set(
    lessonRows.filter((row) => row.completed).map((row) => row.lesson_id)
  );
  const starterPackCompleted =
    freeLessonIds.length === 0 ||
    freeLessonIds.every((id) => completedFreeLessonIds.has(id));

  const firstFreeLessonId =
    freeLessonIds.find((id) => !completedFreeLessonIds.has(id)) ?? freeLessonIds[0];
  const starterPackHref = firstFreeLessonId
    ? starterPackLessonHref(firstFreeLessonId)
    : "/dashboard/learn";

  const nextLesson = findNextLesson(
    lessonCatalog,
    access,
    completionMap,
    contentUnlockedMap
  );

  const currentQuiz = findCurrentQuiz(
    quizzes ?? [],
    quizProgressMap,
    access.unlockedCourseIds
  );

  let primaryCta: HomePrimaryCta;
  if (nextLesson) {
    const { lesson, trackId } = nextLesson;
    primaryCta = {
      label: `${lessonUnitLabel(trackId)} ${lesson.lesson_number}: ${lesson.title}`,
      href: lessonLearnHref(lesson.id, trackId),
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

  const motivation: HomeMotivationData = {
    studiedToday,
  };

  return {
    displayName,
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
      quizzesPassed,
    },
    hasAnyProgress,
    showStarterPack: isFreeTier && !starterPackCompleted,
    showLiveTranslate: true,
    showPhotoTranslate: true,
    upcomingEvents: upcoming.slice(0, 2),
    access,
    motivation,
    membersStudiedTodayLabel: formatMembersStudiedTodayLabel(membersStudiedToday),
  };
}
