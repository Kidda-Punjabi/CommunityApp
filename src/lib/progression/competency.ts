import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchLessonCompletionMap,
} from "@/lib/progress/lesson-completion";
import { isQuizPassing, type QuizProgressRow } from "@/lib/progress/quiz-progress";
import type { GameType } from "@/lib/games/types";

export type CompetencyBreakdown = {
  avgQuizScorePct: number | null;
  avgGameAccuracyPct: number | null;
  lessonCompletionPct: number;
  flashcardConfidencePct: number;
  lessonsCompleted: number;
  lessonsTotal: number;
  flashcardsConfident: number;
  flashcardsTotal: number;
  hasRealEvidence: boolean;
};

export type ComputedCompetency = {
  rawScore: number;
  breakdown: CompetencyBreakdown;
};

type LessonRef = {
  id: string;
  course_id: string;
  lesson_number: number;
  pdf_url?: string | null;
  audio_url?: string | null;
  is_free?: boolean;
};

/** Games without a reliable accuracy % in v1 — excluded from game average. */
const GAME_ACCURACY_EXCLUDED: GameType[] = ["streak_survival", "match", "memory_grid", "speed_translate"];

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function sessionAccuracyFromMetadata(
  gameType: GameType,
  score: number,
  metadata: Record<string, unknown> | null
): number | null {
  if (GAME_ACCURACY_EXCLUDED.includes(gameType)) return null;

  const meta = metadata ?? {};
  if (typeof meta.accuracy === "number") {
    return Math.max(0, Math.min(100, Math.round(meta.accuracy)));
  }

  if (typeof meta.correct === "number" && typeof meta.total === "number" && meta.total > 0) {
    return Math.round((meta.correct / meta.total) * 100);
  }

  if (typeof meta.total_pairs === "number" && meta.total_pairs > 0) {
    return Math.round((score / meta.total_pairs) * 100);
  }

  return null;
}

export async function hasRealActivityEvidence(
  supabase: SupabaseClient,
  userId: string,
  lessons: { id: string; course_id: string; lesson_number: number; pdf_url?: string | null; audio_url?: string | null }[] = []
): Promise<boolean> {
  const [
    { count: quizCount },
    { count: gameCount },
    { count: confidentCount },
  ] = await Promise.all([
    supabase
      .from("quiz_progress")
      .select("quiz_id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("game_scores")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("flashcard_progress")
      .select("flashcard_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("confidence", "confident"),
  ]);

  if ((quizCount ?? 0) > 0 || (gameCount ?? 0) > 0 || (confidentCount ?? 0) > 0) {
    return true;
  }

  if (!lessons.length) return false;

  const completionMap = await fetchLessonCompletionMap(supabase, userId, lessons);
  return lessons.some((lesson) => completionMap.get(lesson.id)?.fullyComplete);
}

async function computeAvgQuizScorePct(
  supabase: SupabaseClient,
  userId: string
): Promise<number | null> {
  const { data: progressRows } = await supabase
    .from("quiz_progress")
    .select("quiz_id, completed, score")
    .eq("user_id", userId);

  if (!progressRows?.length) return null;

  const quizIds = progressRows.map((row) => row.quiz_id);
  const { data: questionRows } = await supabase
    .from("quiz_questions")
    .select("quiz_id")
    .in("quiz_id", quizIds);

  const questionCountByQuiz = new Map<string, number>();
  for (const row of questionRows ?? []) {
    questionCountByQuiz.set(row.quiz_id, (questionCountByQuiz.get(row.quiz_id) ?? 0) + 1);
  }

  const percentages: number[] = [];
  for (const row of progressRows) {
    const progress: QuizProgressRow = {
      quiz_id: row.quiz_id,
      completed: row.completed,
      score: row.score,
    };
    const questionCount = questionCountByQuiz.get(row.quiz_id) ?? 0;
    if (!row.completed && row.score == null) continue;

    const score = row.score ?? 0;
    if (score >= 80) {
      percentages.push(score <= 100 ? score : Math.round((score / Math.max(questionCount, 1)) * 100));
      continue;
    }

    if (isQuizPassing(progress, questionCount)) {
      percentages.push(Math.max(score, 80));
    } else if (questionCount > 0) {
      percentages.push(Math.round((score / questionCount) * 100));
    }
  }

  return average(percentages);
}

async function computeAvgGameAccuracyPct(
  supabase: SupabaseClient,
  userId: string
): Promise<number | null> {
  const { data: rows } = await supabase
    .from("game_scores")
    .select("game_type, score, metadata")
    .eq("user_id", userId);

  const accuracies: number[] = [];
  for (const row of rows ?? []) {
    const accuracy = sessionAccuracyFromMetadata(
      row.game_type as GameType,
      row.score,
      (row.metadata as Record<string, unknown>) ?? null
    );
    if (accuracy != null) accuracies.push(accuracy);
  }

  return average(accuracies);
}

async function computeLessonCompletionPct(
  supabase: SupabaseClient,
  userId: string,
  lessons: LessonRef[]
): Promise<{ pct: number; completed: number; total: number }> {
  if (!lessons.length) return { pct: 0, completed: 0, total: 0 };

  const completionMap = await fetchLessonCompletionMap(supabase, userId, lessons);
  const completed = lessons.filter(
    (lesson) => completionMap.get(lesson.id)?.fullyComplete
  ).length;

  return {
    pct: Math.round((completed / lessons.length) * 100),
    completed,
    total: lessons.length,
  };
}

async function computeFlashcardConfidencePct(
  supabase: SupabaseClient,
  userId: string
): Promise<{ pct: number; confident: number; total: number }> {
  const { count: total } = await supabase
    .from("flashcards")
    .select("id", { count: "exact", head: true });

  if (!total) return { pct: 0, confident: 0, total: 0 };

  const { count: confident } = await supabase
    .from("flashcard_progress")
    .select("flashcard_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("confidence", "confident");

  const confidentCount = confident ?? 0;
  return {
    pct: Math.round((confidentCount / total) * 100),
    confident: confidentCount,
    total,
  };
}

export function combineCompetencyScore(breakdown: CompetencyBreakdown): number {
  const quiz = breakdown.avgQuizScorePct ?? 0;
  const games = breakdown.avgGameAccuracyPct ?? 0;
  const lessons = breakdown.lessonCompletionPct;
  const flashcards = breakdown.flashcardConfidencePct;

  const raw =
    0.4 * quiz + 0.35 * games + 0.15 * lessons + 0.1 * flashcards;

  return Math.max(0, Math.min(100, Math.round(raw)));
}

export async function computeUserCompetency(
  supabase: SupabaseClient,
  userId: string,
  lessons: LessonRef[]
): Promise<ComputedCompetency> {
  const hasEvidence = await hasRealActivityEvidence(supabase, userId, lessons);

  const [avgQuizScorePct, avgGameAccuracyPct, lessonStats, flashcardStats] =
    await Promise.all([
      computeAvgQuizScorePct(supabase, userId),
      computeAvgGameAccuracyPct(supabase, userId),
      computeLessonCompletionPct(supabase, userId, lessons),
      computeFlashcardConfidencePct(supabase, userId),
    ]);

  const breakdown: CompetencyBreakdown = {
    avgQuizScorePct,
    avgGameAccuracyPct,
    lessonCompletionPct: lessonStats.pct,
    flashcardConfidencePct: flashcardStats.pct,
    lessonsCompleted: lessonStats.completed,
    lessonsTotal: lessonStats.total,
    flashcardsConfident: flashcardStats.confident,
    flashcardsTotal: flashcardStats.total,
    hasRealEvidence: hasEvidence,
  };

  return {
    rawScore: combineCompetencyScore(breakdown),
    breakdown,
  };
}
