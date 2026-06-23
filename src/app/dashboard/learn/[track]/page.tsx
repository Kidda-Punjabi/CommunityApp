import { LearnLessonList } from "@/components/learn-lesson-list";
import { LearnLockedCourse } from "@/components/learn-locked-course";
import {
  CommunityLeadSection,
  MyTutorSection,
} from "@/components/learn/course-staff-section";
import {
  fetchLearnContent,
  filterFreeLessons,
} from "@/lib/learning/load-learn-content";
import {
  canAccessLessonInContext,
  filterLessonsForTrack,
  isLearnTrackUnlocked,
  isLessonContentUnlockedForUser,
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
import {
  loadCommunityLeads,
  loadMyTutorForTier,
} from "@/lib/tutoring/load-course-staff";
import {
  fetchLessonContentUnlockMap,
  fetchLessonRecordingsForUser,
} from "@/lib/tutoring/lesson-content-access";
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
    const [completionMap, contentUnlockedMap, recordingMap] = await Promise.all([
      fetchLessonCompletionMap(supabase, user!.id, lessons),
      fetchLessonContentUnlockMap(supabase, user!.id, lessons, access),
      fetchLessonRecordingsForUser(supabase, user!.id, lessons.map((lesson) => lesson.id)),
    ]);
    const accessibleLessons = lessons.filter((lesson) => {
      const canBrowse = canAccessLessonInContext(access, lesson);
      const contentUnlocked = isLessonContentUnlockedForUser(
        access,
        lesson,
        contentUnlockedMap.get(lesson.id)
      );
      return canBrowse && contentUnlocked;
    });
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
        contentUnlockedMap={contentUnlockedMap}
        recordingMap={recordingMap}
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
  const [completionMap, contentUnlockedMap, recordingMap] = await Promise.all([
    fetchLessonCompletionMap(supabase, user!.id, lessons),
    fetchLessonContentUnlockMap(supabase, user!.id, lessons, access),
    fetchLessonRecordingsForUser(supabase, user!.id, lessons.map((lesson) => lesson.id)),
  ]);
  const accessibleLessons = lessons.filter((lesson) => {
    const canBrowse = canAccessLessonInContext(access, lesson);
    const contentUnlocked = isLessonContentUnlockedForUser(
      access,
      lesson,
      contentUnlockedMap.get(lesson.id)
    );
    return canBrowse && contentUnlocked;
  });
  const courseProgress = summarizeCourseProgress(accessibleLessons, completionMap);

  let staffSection = null;

  if (track.id === "foundational" || track.id === "beginners") {
    const tutorInfo = await loadMyTutorForTier(
      supabase,
      user!.id,
      track.id,
      access.courses
    );
    if (tutorInfo) {
      staffSection = <MyTutorSection tutorInfo={tutorInfo} />;
    }
  } else if (track.id === "community") {
    const leads = await loadCommunityLeads(supabase);
    staffSection = <CommunityLeadSection leads={leads} />;
  }

  return (
    <LearnLessonList
      title={track.title}
      subtitle={
        track.id === "community"
          ? `${lessons.length} week${lessons.length === 1 ? "" : "s"} of community lessons.`
          : `${lessons.length} lesson${lessons.length === 1 ? "" : "s"} in this course.`
      }
      unitLabel={track.id === "community" ? "Week" : undefined}
      lessons={lessons}
      access={access}
      progressMap={lessonProgressMap}
      flashcardProgressMap={flashcardProgressMap}
      completionMap={completionMap}
      courseProgress={{
        completed: courseProgress.completedLessons,
        total: courseProgress.totalLessons,
      }}
      staffSection={staffSection}
      contentUnlockedMap={contentUnlockedMap}
      recordingMap={recordingMap}
    />
  );
}
