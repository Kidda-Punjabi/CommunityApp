import type { SupabaseClient } from "@supabase/supabase-js";
import type { FreeLessonPathItem } from "@/components/learn/free-lessons-path";
import { fetchLearnContent } from "@/lib/learning/load-learn-content";
import { fetchTopicMasteryMap, stageFillsForMastery } from "@/lib/free-lessons/mastery";
import { resolveTopicUnlockState } from "@/lib/free-lessons/unlock";
import { hasPremiumAccess } from "@/lib/membership/premium-access";
import { COMMUNITY_COURSE_ID } from "@/lib/topics/constants";

/** Shared Everyday Punjabi path items for Home and `/dashboard/learn/free`. */
export async function loadEverydayPunjabiPathItems(
  supabase: SupabaseClient,
  userId: string
): Promise<FreeLessonPathItem[]> {
  const allLessons = await fetchLearnContent(supabase);
  const lessons = allLessons
    .filter((lesson) => lesson.course_id === COMMUNITY_COURSE_ID)
    .sort((a, b) => a.lesson_number - b.lesson_number);

  if (lessons.length === 0) return [];

  const [hasPremium, masteryMap] = await Promise.all([
    hasPremiumAccess(supabase, userId),
    fetchTopicMasteryMap(
      supabase,
      userId,
      lessons.map((lesson) => lesson.id)
    ),
  ]);

  return lessons.map((lesson, index) => {
    const mastery = masteryMap.get(lesson.id);
    const previous =
      index > 0 ? masteryMap.get(lessons[index - 1].id) : undefined;
    const unlock = resolveTopicUnlockState({
      lessonNumber: lesson.lesson_number,
      isFree: Boolean(lesson.is_free),
      hasPremium,
      previousMasteryLevel:
        index === 0 ? null : (previous?.mastery_level ?? 0),
    });

    return {
      id: lesson.id,
      title: lesson.title,
      sortIndex: index,
      masteryLevel: mastery?.mastery_level ?? 0,
      fills: stageFillsForMastery(mastery),
      lockReason: unlock.lockReason,
      needsPremium: unlock.needsPremium,
    };
  });
}
