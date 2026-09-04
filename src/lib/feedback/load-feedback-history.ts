import type { SupabaseClient } from "@supabase/supabase-js";

export type FeedbackHistoryEntry = {
  id: string;
  learningRelevance: number;
  tutorEffectiveness: number;
  confidence: number;
  understanding: number | null;
  speaking: number | null;
  comments: string;
  overallScore: number | null;
  submittedAt: string;
};

export async function loadFeedbackHistoryForLesson(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string
): Promise<FeedbackHistoryEntry[]> {
  const { data, error } = await supabase
    .from("feedback_submissions")
    .select(
      "id, learning_relevance, tutor_effectiveness, confidence, understanding, speaking, comments, overall_score, submitted_at"
    )
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .neq("form_variant", "week1")
    .order("submitted_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    learningRelevance: row.learning_relevance,
    tutorEffectiveness: row.tutor_effectiveness,
    confidence: row.confidence,
    understanding: row.understanding,
    speaking: row.speaking,
    comments: row.comments,
    overallScore: row.overall_score,
    submittedAt: row.submitted_at,
  }));
}

/** Lesson IDs the user has already submitted feedback for. */
export async function fetchFeedbackSubmittedLessonIds(
  supabase: SupabaseClient,
  userId: string,
  lessonIds: string[]
): Promise<Set<string>> {
  if (lessonIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("feedback_submissions")
    .select("lesson_id")
    .eq("user_id", userId)
    .in("lesson_id", lessonIds)
    .neq("form_variant", "week1")
    .not("lesson_id", "is", null);

  if (error) throw error;
  return new Set(
    (data ?? [])
      .map((row) => row.lesson_id as string | null)
      .filter((id): id is string => Boolean(id))
  );
}
