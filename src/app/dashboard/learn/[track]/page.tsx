import { LearnLessonList } from "@/components/learn-lesson-list";
import { LearnLockedCourse } from "@/components/learn-locked-course";
import {
  fetchLearnContent,
  filterFreeLessons,
} from "@/lib/learning/load-learn-content";
import {
  canAccessLessonInContext,
  filterLessonsForTrack,
  isLearnTrackUnlocked,
  lessonCountForTrack,
} from "@/lib/learning/learn-access";
import { getLearnTrack } from "@/lib/learning/learn-catalog";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import {
  fetchLessonCompletionMap,
  summarizeCourseProgress,
} from "@/lib/progress/lesson-completion";
import { fetchLessonProgressMap } from "@/lib/progress/lesson-progress";
import { fetchFlashcardProgressMap } from "@/lib/progress/flashcard-progress";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type LearnTrackPageProps = {
  params: Promise<{ track: string }>;
};

export default async function LearnTrackPage({ params }: LearnTrackPageProps) {
  const { track: trackId } = await params;
  const track = getLearnTrack(trackId);

  if (!track) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [access, allLessons, lessonProgressMap, flashcardProgressMap] = await Promise.all([
    getCourseAccessContext(supabase, user!),
    fetchLearnContent(supabase),
    fetchLessonProgressMap(supabase, user!.id),
    fetchFlashcardProgressMap(supabase, user!.id),
  ]);

  if (track.alwaysUnlocked) {
    const lessons = filterFreeLessons(allLessons);
    const completionMap = await fetchLessonCompletionMap(supabase, user!.id, lessons);
    const accessibleLessons = lessons.filter((lesson) =>
      canAccessLessonInContext(access, lesson)
    );
    const courseProgress = summarizeCourseProgress(accessibleLessons, completionMap);

    return (
      <LearnLessonList
        title={track.title}
        subtitle="Survival Phrases, comprehensible input, and free starter lessons."
        lessons={lessons}
        access={access}
        progressMap={lessonProgressMap}
        flashcardProgressMap={flashcardProgressMap}
        completionMap={completionMap}
        courseProgress={{
          completed: courseProgress.completedLessons,
          total: courseProgress.totalLessons,
        }}
      />
    );
  }

  if (!track.tier) notFound();

  const unlocked = isLearnTrackUnlocked(track, access);
  const lessonCount = lessonCountForTrack(allLessons, access.courses, track.tier);

  if (!unlocked) {
    return <LearnLockedCourse track={track} lessonCount={lessonCount} />;
  }

  const lessons = filterLessonsForTrack(allLessons, access.courses, track.tier);
  const completionMap = await fetchLessonCompletionMap(supabase, user!.id, lessons);
  const accessibleLessons = lessons.filter((lesson) =>
    canAccessLessonInContext(access, lesson)
  );
  const courseProgress = summarizeCourseProgress(accessibleLessons, completionMap);

  return (
    <LearnLessonList
      title={track.title}
      subtitle={`${lessons.length} lesson${lessons.length === 1 ? "" : "s"} in this course.`}
      lessons={lessons}
      access={access}
      progressMap={lessonProgressMap}
      flashcardProgressMap={flashcardProgressMap}
      completionMap={completionMap}
      courseProgress={{
        completed: courseProgress.completedLessons,
        total: courseProgress.totalLessons,
      }}
    />
  );
}
