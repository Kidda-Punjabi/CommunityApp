import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchLearnEnglishHomeCourse,
  isEnglishFoundationsLessonComplete,
  loadEnglishFoundationsPathItems,
} from "@/lib/learning/english-foundations-path";
import { fetchLearnContent } from "@/lib/learning/load-learn-content";
import { filterLessonsForPrivateCourse } from "@/lib/learning/private-courses";
import { fetchLessonCompletionMap } from "@/lib/progress/lesson-completion";
import { fetchLessonProgressMap } from "@/lib/progress/lesson-progress";

export type EnglishProgression = {
  totalXp: number;
  lessonsCompleted: number;
  lessonsTotal: number;
};

/**
 * English-only stats. Never reads Punjabi total_xp / learner_level.
 */
export async function loadEnglishProgression(
  supabase: SupabaseClient,
  userId: string
): Promise<EnglishProgression> {
  const [{ data: profile, error: profileError }, homeCourse] = await Promise.all([
    supabase.from("profiles").select("english_total_xp").eq("id", userId).maybeSingle(),
    fetchLearnEnglishHomeCourse(supabase, userId),
  ]);

  // Column may be missing until english-progression.sql is applied.
  const totalXp =
    profileError || profile?.english_total_xp == null
      ? 0
      : Number(profile.english_total_xp);

  let lessonsCompleted = 0;
  let lessonsTotal = 0;

  if (homeCourse) {
    const [pathItems, allLessons, progressMap] = await Promise.all([
      loadEnglishFoundationsPathItems(supabase, userId, homeCourse.id),
      fetchLearnContent(supabase),
      fetchLessonProgressMap(supabase, userId),
    ]);
    const courseLessons = filterLessonsForPrivateCourse(allLessons, homeCourse.id);
    const completionMap = await fetchLessonCompletionMap(
      supabase,
      userId,
      courseLessons
    );

    lessonsTotal = pathItems.length;
    lessonsCompleted = pathItems.filter((item) => {
      const completion = completionMap.get(item.id);
      const progress = progressMap.get(item.id);
      return isEnglishFoundationsLessonComplete(completion, progress);
    }).length;
  }

  return {
    totalXp,
    lessonsCompleted,
    lessonsTotal,
  };
}
