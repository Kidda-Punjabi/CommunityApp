import { CatchupPlayer } from "@/components/catchup/catchup-player";
import { canAccessCatchupLesson } from "@/lib/catchup/access";
import { getCourseRequiredTier } from "@/lib/membership/access";
import {
  learnTrackPath,
  learnTrackPathForPaidTier,
} from "@/lib/learning/learn-catalog";
import { catchupDeckIdForLesson, catchupGameRefsForLesson } from "@/lib/catchup/lesson-game-refs";
import { loadCatchupLesson } from "@/lib/catchup/load-catchup";
import {
  loadFillBlankQuestions,
  loadHomeworkTextQuestions,
  loadTranslateQuestions,
} from "@/lib/catchup/load-segment-questions";
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { fetchHomeworkSubmissionsForUser } from "@/lib/tutoring/homework-submissions";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

type PageProps = {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ segment?: string }>;
};

export default async function CatchupLessonPage({ params, searchParams }: PageProps) {
  const { lessonId } = await params;
  const { segment: segmentParam } = await searchParams;
  const initialSegment = Math.max(1, Number(segmentParam ?? "1") || 1);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getCourseAccessContext(supabase, user);
  const isAdminPreview = await canAccessAdminPanel(user, supabase);
  const allowed = await canAccessCatchupLesson(supabase, user, lessonId, access);

  if (!allowed) {
    return (
      <div className={`mx-auto max-w-lg px-5 py-8 ${ui.pageBg}`}>
        <div className={ui.emptyState}>
          <p className="text-sm text-zinc-600">
            This catch-up lesson is not unlocked for you yet. Your tutor will open it when you need
            to review before your next live session.
          </p>
          <Link href="/dashboard/learn" className={`${ui.btnSecondary} mt-4`}>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const lesson = await loadCatchupLesson(supabase, user.id, lessonId);

  if (!lesson) {
    return (
      <div className={`mx-auto max-w-lg px-5 py-8 ${ui.pageBg}`}>
        <p className="text-sm text-zinc-600">Lesson not found.</p>
      </div>
    );
  }

  const { data: lessonRow } = await supabase
    .from("lessons")
    .select("course_id, is_free")
    .eq("id", lessonId)
    .single();

  let learnReturnHref = "/dashboard/learn";
  if (lessonRow?.is_free) {
    learnReturnHref = learnTrackPath("free");
  } else if (lessonRow?.course_id) {
    const { data: course } = await supabase
      .from("courses")
      .select("id, name, required_tier")
      .eq("id", lessonRow.course_id)
      .maybeSingle();
    if (course) {
      const tier = getCourseRequiredTier(course);
      learnReturnHref = learnTrackPath(learnTrackPathForPaidTier(tier));
    }
  }

  const segmentIdByNumber = Object.fromEntries(
    lesson.segments.map((segment) => [segment.segmentNumber, segment.id])
  );
  const gameRefs = catchupGameRefsForLesson(lesson.lessonNumber, lessonId, segmentIdByNumber);
  const deckId = catchupDeckIdForLesson(lesson.lessonNumber);

  const fillBlankBySegmentId: Record<string, Awaited<ReturnType<typeof loadFillBlankQuestions>>> =
    {};
  const translateBySegmentId: Record<string, Awaited<ReturnType<typeof loadTranslateQuestions>>> =
    {};

  await Promise.all(
    lesson.segments.map(async (segment) => {
      if (segment.activityType === "fill_blank") {
        fillBlankBySegmentId[segment.id] = await loadFillBlankQuestions(supabase, segment.id);
      }
      if (segment.activityType === "translate") {
        translateBySegmentId[segment.id] = await loadTranslateQuestions(supabase, segment.id);
      }
    })
  );

  const homeworkSegment = lesson.segments.find(
    (segment) => segment.activityType === "homework" && segment.homeworkSubmissionType === "text"
  );
  const homeworkQuestions = homeworkSegment
    ? await loadHomeworkTextQuestions(supabase, homeworkSegment.id)
    : [];

  const homeworkSubmissionMap = await fetchHomeworkSubmissionsForUser(supabase, user.id, [lessonId]);
  const homeworkSubmission = homeworkSubmissionMap.get(lessonId) ?? null;

  return (
    <div className={`mx-auto min-h-dvh max-w-lg px-5 py-8 ${ui.pageBg}`}>
      {isAdminPreview ? (
        <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
          Admin preview — students only see this when their tutor unlocks the lesson.
        </div>
      ) : null}
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading player…</p>}>
        <CatchupPlayer
          lesson={lesson}
          initialSegmentNumber={initialSegment}
          courseId={lessonRow?.course_id ?? ""}
          learnReturnHref={learnReturnHref}
          gameRefs={gameRefs}
          deckId={deckId}
          fillBlankBySegmentId={fillBlankBySegmentId}
          translateBySegmentId={translateBySegmentId}
          homeworkQuestions={homeworkQuestions}
          homeworkSubmission={homeworkSubmission}
        />
      </Suspense>
    </div>
  );
}
