"use server";

import { recordTopicActivityResult } from "@/lib/free-lessons/mastery";
import { saveFlashcardConfidence } from "@/lib/progress/flashcard-progress";
import { recordStreakActivity } from "@/lib/progress/streak";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function completeTopicActivity(input: {
  lessonId: string;
  passed: boolean;
  scorePercent: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const scorePercent = Math.max(0, Math.min(100, Math.round(input.scorePercent)));
  const result = await recordTopicActivityResult(
    supabase,
    user.id,
    input.lessonId,
    input.passed,
    scorePercent
  );

  // Depth-level pass counts as learning for the day (once-per-day in update_user_streak).
  if (input.passed) {
    await recordStreakActivity(supabase, user.id).catch(() => {
      /* non-fatal — mastery already saved */
    });
  }

  revalidatePath("/dashboard/learn");
  revalidatePath("/dashboard/learn/free");
  revalidatePath(`/dashboard/learn/free/${input.lessonId}`);
  revalidatePath(`/dashboard/learn/free/${input.lessonId}/practice`);

  return result;
}

export async function markTopicVocabReviewed(input: {
  lessonId: string;
  flashcardId: string;
  confident: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  await saveFlashcardConfidence(
    supabase,
    user.id,
    input.flashcardId,
    input.confident ? "confident" : "not_confident"
  );

  revalidatePath(`/dashboard/learn/free/${input.lessonId}`);
  revalidatePath(`/dashboard/learn/free/${input.lessonId}/vocab`);
}
