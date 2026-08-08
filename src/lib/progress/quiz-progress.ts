import type { SupabaseClient } from "@supabase/supabase-js";
import {
  awardQuizAttemptPoints,
  tryAwardLessonCompletionPoints,
} from "@/lib/leaderboard/points";
import {
  learningProductForLesson,
  learningProductForQuiz,
} from "@/lib/learning/learning-product";

export const PASSING_QUIZ_SCORE = 80;

export type QuizProgressRow = {
  quiz_id: string;
  completed: boolean;
  score: number | null;
};

/** Score in DB may be percentage (new) or raw correct count (legacy). */
export function isQuizPassing(
  progress: Pick<QuizProgressRow, "completed" | "score"> | undefined,
  questionCount: number
): boolean {
  if (!progress?.completed) return false;

  const score = progress.score ?? 0;
  if (score >= PASSING_QUIZ_SCORE) return true;
  if (questionCount <= 0) return false;

  return Math.round((score / questionCount) * 100) >= PASSING_QUIZ_SCORE;
}

export function quizScorePercent(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

export type QuizLevelStatus = "completed" | "current" | "locked";

export type QuizLevelItem = {
  id: string;
  level_number: number;
  title: string;
  status: QuizLevelStatus;
};

export async function fetchQuizProgressMap(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, QuizProgressRow>> {
  const { data } = await supabase
    .from("quiz_progress")
    .select("quiz_id, completed, score")
    .eq("user_id", userId);

  return new Map((data ?? []).map((row) => [row.quiz_id, row]));
}

export type SaveQuizProgressResult = {
  quizPoints: number;
  lessonBonus: number;
};

export async function saveQuizProgress(
  supabase: SupabaseClient,
  userId: string,
  quizId: string,
  score: number,
  options?: { lessonId?: string | null }
): Promise<SaveQuizProgressResult> {
  const { error } = await supabase.from("quiz_progress").upsert(
    {
      user_id: userId,
      quiz_id: quizId,
      completed: true,
      score,
      last_attempted_at: new Date().toISOString(),
    },
    { onConflict: "user_id,quiz_id" }
  );

  if (error) throw error;

  const product = options?.lessonId
    ? await learningProductForLesson(supabase, options.lessonId)
    : await learningProductForQuiz(supabase, quizId);

  const quizPoints = await awardQuizAttemptPoints(
    supabase,
    score,
    undefined,
    product
  );
  let lessonBonus = 0;
  if (options?.lessonId) {
    lessonBonus = await tryAwardLessonCompletionPoints(supabase, options.lessonId);
  }

  return { quizPoints, lessonBonus };
}

export function buildQuizLevelPathway(
  quizzes: { id: string; level_number: number; title: string }[],
  progressMap: Map<string, QuizProgressRow>,
  hasCourseAccess: boolean
): QuizLevelItem[] {
  const sorted = [...quizzes].sort((a, b) => a.level_number - b.level_number);
  const completedIds = new Set(
    [...progressMap.entries()]
      .filter(([, row]) => row.completed)
      .map(([quizId]) => quizId)
  );

  let foundCurrent = false;

  return sorted.map((quiz) => {
    const previousQuiz = sorted.find((q) => q.level_number === quiz.level_number - 1);
    const previousDone = !previousQuiz || completedIds.has(previousQuiz.id);
    const unlocked =
      hasCourseAccess && (quiz.level_number === 1 || previousDone);

    if (!unlocked) {
      return { ...quiz, status: "locked" as const };
    }

    if (completedIds.has(quiz.id)) {
      return { ...quiz, status: "completed" as const };
    }

    if (!foundCurrent) {
      foundCurrent = true;
      return { ...quiz, status: "current" as const };
    }

    return { ...quiz, status: "locked" as const };
  });
}

export async function isQuizLevelUnlocked(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
  levelNumber: number
): Promise<boolean> {
  if (levelNumber <= 1) return true;

  const { data: previousQuiz } = await supabase
    .from("quizzes")
    .select("id")
    .eq("course_id", courseId)
    .eq("level_number", levelNumber - 1)
    .maybeSingle();

  if (!previousQuiz) return true;

  const { data: progress } = await supabase
    .from("quiz_progress")
    .select("completed")
    .eq("user_id", userId)
    .eq("quiz_id", previousQuiz.id)
    .maybeSingle();

  return Boolean(progress?.completed);
}
