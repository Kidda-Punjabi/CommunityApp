import { LearnLessonList } from "@/components/learn-lesson-list";
import {
  BuyExtraOneToOneCard,
  PackageHubPanel,
} from "@/components/packages/package-hub-panel";
import {
  findStudentPackageForTrack,
  loadStudentPackages,
} from "@/lib/packages/load-student-packages";
import {
  fetchLearnContent,
  filterFreeLessons,
} from "@/lib/learning/load-learn-content";
import {
  canAccessLessonInContext,
  filterLessonsForTrack,
  isLearnTrackUnlocked,
  isLessonContentUnlockedForUser,
} from "@/lib/learning/learn-access";
import { getLearnTrack } from "@/lib/learning/learn-catalog";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import {
  fetchLessonCompletionMap,
  summarizeCourseProgress,
} from "@/lib/progress/lesson-completion";
import { fetchLessonProgressMap } from "@/lib/progress/lesson-progress";
import { fetchFlashcardProgressMap } from "@/lib/progress/flashcard-progress";
import { fetchQuizProgressMap } from "@/lib/progress/quiz-progress";
import { CommunityLeadSection } from "@/components/learn/course-staff-section";
import {
  loadCommunityLeads,
} from "@/lib/tutoring/load-course-staff";
import {
  fetchLessonContentUnlockMap,
  fetchLessonRecordingsForUser,
} from "@/lib/tutoring/lesson-content-access";
import { fetchHomeworkSubmissionsForUser } from "@/lib/tutoring/homework-submissions";
import { fetchCatchupEnabledLessonIds } from "@/lib/catchup/load-catchup";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

type LearnTrackPageProps = {
  params: Promise<{ track: string }>;
  searchParams: Promise<{ homework?: string; catchupReturn?: string }>;
};

export default async function LearnTrackPage({ params, searchParams }: LearnTrackPageProps) {
  const { track: trackId } = await params;
  const { homework: homeworkFocusLessonId, catchupReturn } = await searchParams;
  const track = getLearnTrack(trackId);

  if (!track) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [access, allLessons, lessonProgressMap, flashcardProgressMap, quizProgressMap, studentPackages] =
    await Promise.all([
      getCourseAccessContext(supabase, user!),
      fetchLearnContent(supabase),
      fetchLessonProgressMap(supabase, user!.id),
      fetchFlashcardProgressMap(supabase, user!.id),
      fetchQuizProgressMap(supabase, user!.id),
      loadStudentPackages(supabase, user!),
    ]);

  if (track.alwaysUnlocked) {
    const lessons = filterFreeLessons(allLessons);
    const [completionMap, contentUnlockedMap, recordingMap, catchupLessonIds] = await Promise.all([
      fetchLessonCompletionMap(supabase, user!.id, lessons),
      fetchLessonContentUnlockMap(supabase, user!.id, lessons, access),
      fetchLessonRecordingsForUser(supabase, user!.id, lessons.map((lesson) => lesson.id)),
      fetchCatchupEnabledLessonIds(
        supabase,
        lessons.map((lesson) => lesson.id)
      ),
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
    const courseProgress = summarizeCourseProgress(lessons, completionMap);

    return (
      <LearnLessonList
        title={track.title}
        subtitle="Survival Phrases, comprehensible input, and free starter lessons."
        lessons={lessons}
        access={access}
        progressMap={lessonProgressMap}
        flashcardProgressMap={flashcardProgressMap}
        quizProgressMap={quizProgressMap}
        completionMap={completionMap}
        contentUnlockedMap={contentUnlockedMap}
        recordingMap={recordingMap}
        catchupLessonIds={catchupLessonIds}
        courseProgress={{
          completed: courseProgress.completedLessons,
          total: courseProgress.totalLessons,
        }}
      />
    );
  }

  if (!track.tier) notFound();

  const unlocked = isLearnTrackUnlocked(track, access);

  if (!unlocked) {
    redirect(`/courses/${track.id}#pricing`);
  }

  const lessons = filterLessonsForTrack(allLessons, access.courses, track.tier);
  const showHomework = track.id === "foundational" || track.id === "beginners";
  const lessonIds = lessons.map((lesson) => lesson.id);
  const [completionMap, contentUnlockedMap, recordingMap, homeworkMap, catchupLessonIds] =
    await Promise.all([
    fetchLessonCompletionMap(supabase, user!.id, lessons),
    fetchLessonContentUnlockMap(supabase, user!.id, lessons, access),
    fetchLessonRecordingsForUser(supabase, user!.id, lessonIds),
    showHomework
      ? fetchHomeworkSubmissionsForUser(supabase, user!.id, lessonIds)
      : Promise.resolve(new Map()),
    fetchCatchupEnabledLessonIds(supabase, lessonIds),
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
  const courseProgress = summarizeCourseProgress(lessons, completionMap);
  const studentPackage = findStudentPackageForTrack(studentPackages, track.id);

  let staffSection = null;

  if (studentPackage) {
    if (track.id === "community") {
      const leads = await loadCommunityLeads(supabase);
      staffSection = (
        <>
          <PackageHubPanel pkg={studentPackage} />
          <CommunityLeadSection leads={leads} />
        </>
      );
    } else {
      staffSection = <PackageHubPanel pkg={studentPackage} />;
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
      quizProgressMap={quizProgressMap}
      completionMap={completionMap}
      courseProgress={{
        completed: courseProgress.completedLessons,
        total: courseProgress.totalLessons,
      }}
      staffSection={staffSection}
      footerSection={
        studentPackage ? <BuyExtraOneToOneCard pkg={studentPackage} /> : null
      }
      contentUnlockedMap={contentUnlockedMap}
      recordingMap={recordingMap}
      homeworkMap={homeworkMap}
      showHomework={showHomework}
      catchupLessonIds={catchupLessonIds}
      homeworkFocusLessonId={homeworkFocusLessonId ?? null}
      catchupReturn={catchupReturn ?? null}
    />
  );
}
