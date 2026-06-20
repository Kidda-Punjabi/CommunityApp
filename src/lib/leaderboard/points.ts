import type { SupabaseClient } from "@supabase/supabase-js";
import { getLocalActivityDate } from "@/lib/progress/activity-date";
import { notifyActivityRewards } from "@/lib/points/notify-points-earned";
import { getCurrentWeekStart } from "./week";

export function quizAttemptPoints(scorePercent: number): number {
  const pct = Math.max(0, Math.min(100, Math.round(scorePercent)));
  return 10 + Math.floor(pct / 10);
}

export function gameSessionPoints(accuracyPercent: number): number {
  return quizAttemptPoints(accuracyPercent);
}

export function flashcardConfidentPoints(): number {
  return 1;
}

export function lessonCompletedPoints(): number {
  return 25;
}

export function accuracyFromGameMetadata(
  metadata: Record<string, unknown> | null | undefined
): number | null {
  const meta = metadata ?? {};
  if (typeof meta.accuracy === "number") {
    return Math.max(0, Math.min(100, Math.round(meta.accuracy)));
  }
  if (
    typeof meta.correct === "number" &&
    typeof meta.total === "number" &&
    meta.total > 0
  ) {
    return Math.round((meta.correct / meta.total) * 100);
  }
  return null;
}

export function buildGameAccuracyMetadata(
  correct: number,
  total: number
): Record<string, number> {
  const safeTotal = Math.max(total, 1);
  const accuracy = Math.round((Math.max(0, correct) / safeTotal) * 100);
  return { correct: Math.max(0, correct), total: safeTotal, accuracy };
}

/** Best-effort weekly points award — never throws to callers. Returns points granted. */
export async function awardWeeklyPoints(
  supabase: SupabaseClient,
  points: number,
  activityDate?: string
): Promise<number> {
  if (points <= 0) return 0;

  const date = activityDate ?? getLocalActivityDate();
  const { error } = await supabase.rpc("award_weekly_points", {
    p_points: points,
    p_activity_date: date,
  });

  if (error) {
    console.error("Failed to award weekly points:", error.message);
    return 0;
  }

  return points;
}

/** Best-effort lifetime XP award — never throws. Returns XP granted. */
export async function awardXp(
  supabase: SupabaseClient,
  xp: number
): Promise<number> {
  if (xp <= 0) return 0;

  const { error } = await supabase.rpc("award_xp", { p_xp: xp });

  if (error) {
    console.error("Failed to award XP:", error.message);
    return 0;
  }

  return xp;
}

async function awardBoth(
  supabase: SupabaseClient,
  points: number,
  activityDate?: string
): Promise<{ weekly: number; xp: number }> {
  const [weekly, xp] = await Promise.all([
    awardWeeklyPoints(supabase, points, activityDate),
    awardXp(supabase, points),
  ]);
  notifyActivityRewards(weekly, xp);
  return { weekly, xp };
}

export async function tryAwardLessonCompletionPoints(
  supabase: SupabaseClient,
  lessonId: string,
  activityDate?: string
): Promise<number> {
  const date = activityDate ?? getLocalActivityDate();
  const { data, error } = await supabase.rpc("try_award_lesson_completion_points", {
    p_lesson_id: lessonId,
    p_activity_date: date,
  });

  if (error) {
    console.error("Failed to award lesson completion points:", error.message);
    return 0;
  }

  if (data) {
    const pts = lessonCompletedPoints();
    const xp = await awardXp(supabase, pts);
    notifyActivityRewards(pts, xp);
    return pts;
  }

  return 0;
}

export async function awardQuizAttemptPoints(
  supabase: SupabaseClient,
  scorePercent: number,
  activityDate?: string
): Promise<number> {
  const { weekly } = await awardBoth(
    supabase,
    quizAttemptPoints(scorePercent),
    activityDate
  );
  return weekly;
}

export async function awardGameSessionPoints(
  supabase: SupabaseClient,
  metadata: Record<string, unknown> | null | undefined,
  activityDate?: string
): Promise<number> {
  const accuracy = accuracyFromGameMetadata(metadata);
  if (accuracy == null) return 0;
  const { weekly } = await awardBoth(
    supabase,
    gameSessionPoints(accuracy),
    activityDate
  );
  return weekly;
}

export async function awardFlashcardConfidentPoints(
  supabase: SupabaseClient,
  activityDate?: string
): Promise<number> {
  const { weekly } = await awardBoth(
    supabase,
    flashcardConfidentPoints(),
    activityDate
  );
  return weekly;
}

export { getCurrentWeekStart };
