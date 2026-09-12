import { LearnLessonList } from "@/components/learn-lesson-list";
import { PackageHubPanel } from "@/components/packages/package-hub-panel";
import { fetchLearnContent, filterLessonsForCourse } from "@/lib/learning/load-learn-content";
import {
  fetchAccessibleKidsCourses,
  fetchKidsCourseLessonUnlockMap,
} from "@/lib/learning/kids-courses";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { fetchLessonCompletionMap, summarizeCourseProgress } from "@/lib/progress/lesson-completion";
import { fetchLessonProgressMap } from "@/lib/progress/lesson-progress";
import { fetchFlashcardProgressMap } from "@/lib/progress/flashcard-progress";
import { fetchQuizProgressMap } from "@/lib/progress/quiz-progress";
import { fetchLessonRecordingsForUser } from "@/lib/tutoring/lesson-content-access";
import { fetchHomeworkSubmissionsForUser } from "@/lib/tutoring/homework-submissions";
import { fetchFeedbackSubmittedLessonIds } from "@/lib/feedback/load-feedback-history";
import { buildScheduleSessionByLessonId } from "@/lib/calendar/lesson-schedule-map";
import { loadStudentUpcomingSessions } from "@/lib/calendar/load-sessions";
import {
  deriveCohortCurrentWeek,
  formatStartedWeekProgressLine,
} from "@/lib/calendar/cohort-week-progress";
import { loadStudentCohortHomeworkCompletedMap } from "@/lib/lessons/load-student-cohort-homework-completed";
import { loadStudentCohortCourseStats } from "@/lib/lessons/load-student-cohort-course-stats";
import {
  findStudentPackageForCourse,
  loadStudentPackages,
} from "@/lib/packages/load-student-packages";
import { createClient } from "@/lib/supabase/server";
import { lessonHomeworkPath } from "@/lib/tutoring/homework-href";
import { notFound, redirect } from "next/navigation";

type KidsCoursePageProps = {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ homework?: string; catchupReturn?: string }>;
};

export default async function KidsCourseLearnPage({
  params,
  searchParams,
}: KidsCoursePageProps) {
  const { courseId } = await params;
  const { homework: homeworkFocusLessonId, catchupReturn } = await searchParams;

  if (homeworkFocusLessonId) {
    redirect(lessonHomeworkPath(homeworkFocusLessonId, catchupReturn ?? null));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const kidsCourses = await fetchAccessibleKidsCourses(supabase, user.id);
  const course = kidsCourses.find((row) => row.id === courseId);
  if (!course) notFound();

  const [
    access,
    allLessons,
    lessonProgressMap,
    flashcardProgressMap,
    quizProgressMap,
    studentPackages,
  ] = await Promise.all([
    getCourseAccessContext(supabase, user),
    fetchLearnContent(supabase),
    fetchLessonProgressMap(supabase, user.id),
    fetchFlashcardProgressMap(supabase, user.id),
    fetchQuizProgressMap(supabase, user.id),
    loadStudentPackages(supabase, user),
  ]);

  const lessons = filterLessonsForCourse(allLessons, courseId).sort(
    (a, b) => a.lesson_number - b.lesson_number
  );
  const lessonIds = lessons.map((lesson) => lesson.id);
  const courseIds = [courseId];
  const studentPackage = findStudentPackageForCourse(studentPackages, courseId);

  const [
    completionMap,
    contentUnlockedMap,
    recordingMap,
    homeworkMap,
    feedbackSubmittedLessonIds,
    upcomingLoad,
    cohortCourseStats,
    cohortHomeworkCompletedMap,
  ] = await Promise.all([
    fetchLessonCompletionMap(supabase, user.id, lessons),
    fetchKidsCourseLessonUnlockMap(supabase, user.id, courseId, lessonIds),
    fetchLessonRecordingsForUser(supabase, user.id, lessonIds),
    fetchHomeworkSubmissionsForUser(supabase, user.id, lessonIds),
    fetchFeedbackSubmittedLessonIds(supabase, user.id, lessonIds),
    loadStudentUpcomingSessions(supabase, user.id, user.email, {
      includePast: true,
      courseIds,
    }),
    loadStudentCohortCourseStats(supabase, user.id, courseIds),
    loadStudentCohortHomeworkCompletedMap(supabase, user.id, courseIds, lessonIds),
  ]);

  const courseProgress = summarizeCourseProgress(lessons, completionMap);
  const scheduleSessionByLessonId = buildScheduleSessionByLessonId(
    upcomingLoad.sessions,
    lessons,
    courseIds
  );
  const storedWeekSessions = upcomingLoad.sessions.filter(
    (session) => session.cohort_id === studentPackage?.cohortId
  );
  const cohortProgressLine = studentPackage
    ? formatStartedWeekProgressLine({
        startDateIso: studentPackage.cohortStartDate,
        currentWeek: deriveCohortCurrentWeek({
          startDateIso: studentPackage.cohortStartDate,
          totalWeeks: lessons.length,
          sessions: storedWeekSessions,
        }),
        totalWeeks: lessons.length,
      })
    : null;

  return (
    <LearnLessonList
      title="Beginners Course"
      subtitle=""
      lessons={lessons}
      access={access}
      progressMap={lessonProgressMap}
      flashcardProgressMap={flashcardProgressMap}
      quizProgressMap={quizProgressMap}
      completionMap={completionMap}
      showCourseProgress
      courseProgress={{
        completed: courseProgress.completedLessons,
        total: courseProgress.totalLessons,
      }}
      staffSection={
        studentPackage ? (
          <PackageHubPanel
            pkg={studentPackage}
            cohortStats={cohortCourseStats}
            cohortProgressLine={cohortProgressLine}
            showGroupReschedule
          />
        ) : null
      }
      contentUnlockedMap={contentUnlockedMap}
      honorContentUnlockMap
      recordingMap={recordingMap}
      homeworkMap={homeworkMap}
      cohortHomeworkCompletedMap={cohortHomeworkCompletedMap}
      showHomework
      feedbackSubmittedLessonIds={feedbackSubmittedLessonIds}
      homeworkFocusLessonId={homeworkFocusLessonId ?? null}
      catchupReturn={catchupReturn ?? null}
      scheduleSessionByLessonId={scheduleSessionByLessonId}
      statusLegendPosition="top"
    />
  );
}
