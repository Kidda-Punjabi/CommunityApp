import { notFound, redirect } from "next/navigation";
import { WeekPractice } from "@/components/practise/week-practice";
import { filterLessonsForTrack, isLearnTrackUnlocked, isLessonContentUnlockedForUser } from "@/lib/learning/learn-access";
import { resolveGroupCohortContentGate } from "@/lib/learning/group-cohort-content-gate";
import { getLearnTrack } from "@/lib/learning/learn-catalog";
import { fetchLearnContent } from "@/lib/learning/load-learn-content";
import { findCoursesForTier } from "@/lib/membership/courses";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { loadProgress } from "@/lib/practise/load-home";
import { loadWeekPool, summariseWeek } from "@/lib/practise/week-content";
import { createClient } from "@/lib/supabase/server";
import { fetchLessonContentUnlockMap } from "@/lib/tutoring/lesson-content-access";

/** Same rules as the course page: a week's practice opens when that week's lesson does. */
export default async function WeekPracticePage({ params }: { params: Promise<{ week: string }> }) {
  const { week: raw } = await params;
  const week = Number(raw);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const track = getLearnTrack("beginners");
  if (!track?.tier) notFound();
  const [access, allLessons] = await Promise.all([getCourseAccessContext(supabase, user), fetchLearnContent(supabase)]);
  if (!isLearnTrackUnlocked(track, access)) redirect("/courses/beginners#pricing");
  const courseHref = "/dashboard/learn/beginners";
  const gate = await resolveGroupCohortContentGate(supabase, user.id, findCoursesForTier(access.courses, track.tier).map((c) => c.id));
  if (gate?.gated) redirect(courseHref);
  const lessons = filterLessonsForTrack(allLessons, access.courses, track.tier);
  const unlocked = await fetchLessonContentUnlockMap(supabase, user.id, lessons, access);
  const lesson = lessons.find((l) => l.lesson_number === week);
  if (lesson && !isLessonContentUnlockedForUser(access, lesson, unlocked.get(lesson.id))) redirect(courseHref);

  const pool = await loadWeekPool(supabase, week);
  if (!pool) notFound();
  const progress = await loadProgress(supabase, user.id);
  return (
    <WeekPractice
      week={week}
      lessonId={pool.lessonId}
      title={pool.title}
      skills={summariseWeek(pool, progress)}
      decks={pool.decks}
      isRecap={week > 10}
    />
  );
}
