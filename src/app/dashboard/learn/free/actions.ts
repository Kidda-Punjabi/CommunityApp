"use server";

import { recordTopicActivityResult } from "@/lib/free-lessons/mastery";
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

  revalidatePath("/dashboard/learn/free");
  revalidatePath(`/dashboard/learn/free/${input.lessonId}`);
  revalidatePath(`/dashboard/learn/free/${input.lessonId}/practice`);

  return result;
}
