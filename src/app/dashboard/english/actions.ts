"use server";

import { LEARN_ENGLISH_CONTENT_TRACK } from "@/lib/learning/private-courses";
import { saveLessonProgress } from "@/lib/progress/lesson-progress";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { revalidatePath } from "next/cache";

export type MarkEnglishModuleCompleteResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Fallback when a Learn English module has no flashcards/quiz parts.
 * Sets lesson_progress.completed — the same signal the Foundations path
 * already uses when partsTotal === 0.
 */
export async function markEnglishModuleComplete(
  lessonId: string
): Promise<MarkEnglishModuleCompleteResult> {
  const session = await getCachedAuthSession();
  if (!session) return { ok: false, error: "Sign in to continue." };

  const { supabase, user } = session;

  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("id, course_id, courses(content_track)")
    .eq("id", lessonId)
    .maybeSingle();

  if (error || !lesson) {
    return { ok: false, error: "Module not found." };
  }

  const course = Array.isArray(lesson.courses) ? lesson.courses[0] : lesson.courses;
  if (course?.content_track !== LEARN_ENGLISH_CONTENT_TRACK) {
    return { ok: false, error: "Not an English module." };
  }

  const { data: access } = await supabase
    .from("course_access")
    .select("course_id")
    .eq("user_id", user.id)
    .eq("course_id", lesson.course_id)
    .maybeSingle();

  if (!access) {
    return { ok: false, error: "You do not have access to this module." };
  }

  try {
    await saveLessonProgress(supabase, user.id, {
      lessonId,
      lastPosition: 0,
      secondsListened: 0,
      completed: true,
    });
  } catch (err) {
    console.error("markEnglishModuleComplete failed:", err);
    return { ok: false, error: "Could not save progress. Try again." };
  }

  revalidatePath("/dashboard/english");
  revalidatePath(`/dashboard/english/lesson/${lessonId}`);
  return { ok: true };
}
