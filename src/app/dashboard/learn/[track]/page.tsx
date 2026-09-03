import { LearnLessonList } from "@/components/learn-lesson-list";
import { FreeLessonsPath } from "@/components/learn/free-lessons-path";
import { GroupCohortOpensPanel } from "@/components/learn/group-cohort-opens-panel";
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
} from "@/lib/learning/load-learn-content";
import {
  filterLessonsForTrack,
  isLearnTrackUnlocked,
} from "@/lib/learning/learn-access";
import { resolveGroupCohortContentGate } from "@/lib/learning/group-cohort-content-gate";
import { getLearnTrack, shouldShowLearnCourseProgress } from "@/lib/learning/learn-catalog";
import { findCoursesForTier } from "@/lib/membership/courses";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import {
  filterLessonsForPrivateCourse,
  fetchAccessiblePrivateCourses,
} from "@/lib/learning/private-courses";
import {
  fetchLessonCompletionMap,
  summarizeCourseProgress,
} from "@/lib/progress/lesson-completion";
import { fetchLessonProgressMap } from "@/lib/progress/lesson-progress";
import { fetchFlashcardProgressMap } from "@/lib/progress/flashcard-progress";
import { fetchQuizProgressMap } from "@/lib/progress/quiz-progress";
import { CommunityLeadSection } from "@/components/learn/course-staff-section";
import { CourseAboutBlock } from "@/components/learn/course-about-block";
import {
  loadCommunityLeads,
} from "@/lib/tutoring/load-course-staff";
import {
  fetchLessonContentUnlockMap,
  fetchLessonRecordingsForUser,
} from "@/lib/tutoring/lesson-content-access";
import { fetchHomeworkSubmissionsForUser } from "@/lib/tutoring/homework-submissions";
import { fetchFeedbackSubmittedLessonIds } from "@/lib/feedback/load-feedback-history";
import { buildScheduleSessionByLessonId } from "@/lib/calendar/lesson-schedule-map";
import { fetchSessionCatchupLessonIdsForUser } from "@/lib/catchup/session-catchup-eligibility";
import { loadStudentUpcomingSessions } from "@/lib/calendar/load-sessions";
import { loadStudentCohortCourseStats } from "@/lib/lessons/load-student-cohort-course-stats";
import { loadStudentCohortHomeworkCompletedMap } from "@/lib/lessons/load-student-cohort-homework-completed";
import { fetchTopicMasteryMap, stageFillsForMastery } from "@/lib/free-lessons/mastery";
import { resolveTopicUnlockState } from "@/lib/free-lessons/unlock";
import { hasPremiumAccess } from "@/lib/membership/premium-access";
import { COMMUNITY_COURSE_ID } from "@/lib/topics/constants";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createClient } from "@/lib/supabase/server";
import { lessonHomeworkPath } from "@/lib/tutoring/homework-href";
import { ui } from "@/lib/ui/styles";
import { BackLink } from "@/components/navigation/back-link";
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

  if (homeworkFocusLessonId) {
    redirect(lessonHomeworkPath(homeworkFocusLessonId, catchupReturn ?? null));
  }

  if (trackId === "community") {
    await requireNoKidCommunityAccess();
  }

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
    const lessons = allLessons
      .filter((lesson) => lesson.course_id === COMMUNITY_COURSE_ID)
      .sort((a, b) => a.lesson_number - b.lesson_number);

    const [hasPremium, masteryMap] = await Promise.all([
      hasPremiumAccess(supabase, user!.id),
      fetchTopicMasteryMap(
        supabase,
        user!.id,
        lessons.map((lesson) => lesson.id)
      ),
    ]);

    const pathItems = lessons.map((lesson, index) => {
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

    return (
      <div className={ui.page}>
        <BackLink href="/dashboard/learn">← Back</BackLink>
        <div className="mb-8 mt-4 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            {track.title}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{track.description}</p>
        </div>
        {pathItems.length > 0 ? (
          <FreeLessonsPath items={pathItems} />
        ) : (
          <p className="text-center text-sm text-zinc-500">
            No topics yet. Check back soon.
          </p>
        )}
      </div>
    );
  }

  if (track.privateAccess) {
    const privateCourses = await fetchAccessiblePrivateCourses(supabase, user!.id);
    const privateCourse = privateCourses[0];
    if (!privateCourse) {
      redirect("/dashboard/learn");
    }

    if (!access.unlockedCourseIds.has(privateCourse.id)) {
      redirect("/dashboard/learn");
    }

    const lessons = filterLessonsForPrivateCourse(allLessons, privateCourse.id);
    const lessonIds = lessons.map((lesson) => lesson.id);

    const [
      completionMap,
      contentUnlockedMap,
      recordingMap,
      sessionCatchupLessonIds,
      feedbackSubmittedLessonIds,
    ] = await Promise.all([
      fetchLessonCompletionMap(supabase, user!.id, lessons),
      fetchLessonContentUnlockMap(supabase, user!.id, lessons, access),
      fetchLessonRecordingsForUser(supabase, user!.id, lessonIds),
      fetchSessionCatchupLessonIdsForUser(supabase, user!.id, lessons),
      fetchFeedbackSubmittedLessonIds(supabase, user!.id, lessonIds),
    ]);

    return (
      <LearnLessonList
        title={privateCourse.name}
        subtitle={`${lessons.length} lesson${lessons.length === 1 ? "" : "s"} in this course.`}
        unitLabel="Week"
        lessons={lessons}
        access={access}
        progressMap={lessonProgressMap}
        flashcardProgressMap={flashcardProgressMap}
        quizProgressMap={quizProgressMap}
        completionMap={completionMap}
        showCourseProgress={false}
        contentUnlockedMap={contentUnlockedMap}
        recordingMap={recordingMap}
        showHomework={false}
        catchupLessonIds={sessionCatchupLessonIds}
        feedbackSubmittedLessonIds={feedbackSubmittedLessonIds}
        homeworkFocusLessonId={homeworkFocusLessonId ?? null}
        catchupReturn={catchupReturn ?? null}
      />
    );
  }

  if (!track.tier) notFound();

  const unlocked = isLearnTrackUnlocked(track, access);

  if (!unlocked) {
    redirect(`/courses/${track.id}#pricing`);
  }

  const courseIds = findCoursesForTier(access.courses, track.tier).map((c) => c.id);
  const contentGate = await resolveGroupCohortContentGate(supabase, user!.id, courseIds);

  const studentPackage = findStudentPackageForTrack(studentPackages, track.id);
  const communityLeads =
    track.id === "community" ? await loadCommunityLeads(supabase) : null;

  let staffSection = null;
  if (studentPackage) {
    staffSection =
      track.id === "community" && communityLeads ? (
        <>
          <PackageHubPanel pkg={studentPackage} />
          <CommunityLeadSection leads={communityLeads} />
        </>
      ) : (
        <PackageHubPanel pkg={studentPackage} />
      );
  } else if (communityLeads) {
    staffSection = <CommunityLeadSection leads={communityLeads} />;
  }

  if (contentGate?.gated) {
    return (
      <GroupCohortOpensPanel
        title={track.title}
        message={contentGate.message}
        staffSection={staffSection}
      />
    );
  }

  const lessons = filterLessonsForTrack(allLessons, access.courses, track.tier);
  const showHomework = track.id === "foundational" || track.id === "beginners";
  const lessonIds = lessons.map((lesson) => lesson.id);

  const [
    completionMap,
    contentUnlockedMap,
    recordingMap,
    homeworkMap,
    sessionCatchupLessonIds,
    feedbackSubmittedLessonIds,
    upcomingLoad,
    cohortCourseStats,
    cohortHomeworkCompletedMap,
  ] = await Promise.all([
      fetchLessonCompletionMap(supabase, user!.id, lessons),
      fetchLessonContentUnlockMap(supabase, user!.id, lessons, access),
      fetchLessonRecordingsForUser(supabase, user!.id, lessonIds),
      showHomework
        ? fetchHomeworkSubmissionsForUser(supabase, user!.id, lessonIds)
        : Promise.resolve(new Map()),
      fetchSessionCatchupLessonIdsForUser(supabase, user!.id, lessons),
      fetchFeedbackSubmittedLessonIds(supabase, user!.id, lessonIds),
      loadStudentUpcomingSessions(supabase, user!.id, user!.email, {
        includePast: true,
        courseIds,
      }),
      loadStudentCohortCourseStats(supabase, user!.id, courseIds),
      showHomework
        ? loadStudentCohortHomeworkCompletedMap(
            supabase,
            user!.id,
            courseIds,
            lessonIds
          )
        : Promise.resolve(new Map<string, boolean>()),
    ]);

  if (studentPackage) {
    staffSection =
      track.id === "community" && communityLeads ? (
        <>
          <PackageHubPanel pkg={studentPackage} cohortStats={cohortCourseStats} />
          <CommunityLeadSection leads={communityLeads} />
        </>
      ) : (
        <PackageHubPanel pkg={studentPackage} cohortStats={cohortCourseStats} />
      );
  }
  const courseProgress = summarizeCourseProgress(lessons, completionMap);
  const scheduleSessionByLessonId = buildScheduleSessionByLessonId(
    upcomingLoad.sessions,
    lessons,
    courseIds
  );

  return (
    <LearnLessonList
      title={track.title}
      subtitle={
        track.id === "community"
          ? `${lessons.length} week${lessons.length === 1 ? "" : "s"} of community lessons.`
          : track.id === "beginners"
            ? ""
            : `${lessons.length} lesson${lessons.length === 1 ? "" : "s"} in this course.`
      }
      unitLabel={track.id === "community" ? "Week" : undefined}
      lessons={lessons}
      access={access}
      progressMap={lessonProgressMap}
      flashcardProgressMap={flashcardProgressMap}
      quizProgressMap={quizProgressMap}
      completionMap={completionMap}
      showCourseProgress={shouldShowLearnCourseProgress(track.id)}
      courseProgress={
        shouldShowLearnCourseProgress(track.id)
          ? {
              completed: courseProgress.completedLessons,
              total: courseProgress.totalLessons,
            }
          : undefined
      }
      staffSection={staffSection}
      footerSection={
        track.id === "beginners" || studentPackage ? (
          <div className="space-y-4">
            {track.id === "beginners" ? <CourseAboutBlock level="beginners" /> : null}
            {studentPackage ? <BuyExtraOneToOneCard pkg={studentPackage} /> : null}
          </div>
        ) : null
      }
      contentUnlockedMap={contentUnlockedMap}
      recordingMap={recordingMap}
      homeworkMap={homeworkMap}
      cohortHomeworkCompletedMap={cohortHomeworkCompletedMap}
      showHomework={showHomework}
      catchupLessonIds={sessionCatchupLessonIds}
      feedbackSubmittedLessonIds={feedbackSubmittedLessonIds}
      homeworkFocusLessonId={homeworkFocusLessonId ?? null}
      catchupReturn={catchupReturn ?? null}
      scheduleSessionByLessonId={scheduleSessionByLessonId}
    />
  );
}
