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
