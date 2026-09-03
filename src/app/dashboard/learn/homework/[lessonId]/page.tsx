import { CatchupReturnButton } from "@/components/catchup/catchup-return-button";
import { HomeworkSubmissionSection } from "@/components/homework/homework-submission-section";
import { HomeworkTextForm } from "@/components/homework/homework-text-form";
import { BackLink } from "@/components/navigation/back-link";
import { canAccessLessonInContext } from "@/lib/learning/learn-access";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { createClient } from "@/lib/supabase/server";
import { learnHomeworkBackHref } from "@/lib/tutoring/homework-href";
import {
  loadHomeworkQuestionsForLesson,
  loadHomeworkSegmentForLesson,
} from "@/lib/tutoring/homework-questions";
import { fetchHomeworkSubmissionsForUser } from "@/lib/tutoring/homework-submissions";
import { parseCatchupReturn } from "@/lib/catchup/return-url";
import { ui } from "@/lib/ui/styles";
import { notFound, redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ catchupReturn?: string }>;
};

export default async function LessonHomeworkPage({ params, searchParams }: PageProps) {
  const { lessonId } = await params;
  const { catchupReturn: catchupReturnRaw } = await searchParams;
  const catchupReturn = parseCatchupReturn(catchupReturnRaw ?? null)
    ? (catchupReturnRaw ?? null)
    : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, lesson_number, title, course_id, is_free, courses(required_tier, name)")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) notFound();

  const access = await getCourseAccessContext(supabase, user);
  if (!canAccessLessonInContext(access, lesson)) {
    redirect("/dashboard/learn");
  }

  const courseRow = Array.isArray(lesson.courses) ? lesson.courses[0] : lesson.courses;
  const courseName = (courseRow as { name: string } | null)?.name ?? "Course";
  const requiredTier = (courseRow as { required_tier: string } | null)?.required_tier;
  const backHref = learnHomeworkBackHref(requiredTier, lessonId, lesson.course_id);

  const [segment, submissionMap] = await Promise.all([
    loadHomeworkSegmentForLesson(supabase, lessonId),
    fetchHomeworkSubmissionsForUser(supabase, user.id, [lessonId]),
  ]);

  const submissionType = segment?.submissionType ?? "voice";
  const questions =
    submissionType === "text" ? await loadHomeworkQuestionsForLesson(supabase, lessonId) : [];
  const submission = submissionMap.get(lessonId) ?? null;
  const taskDescription =
    segment?.activityInstructions?.trim() ||
    (submissionType === "text"
      ? "Write your answers below. Your tutor will review them."
      : "Record a short voice note for your tutor after your session.");

  return (
    <div className={ui.page}>
      <BackLink fallbackHref={backHref}>← Back to lessons</BackLink>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-600">
          Lesson {lesson.lesson_number} · {courseName}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">Homework</h1>
        <p className="mt-2 text-sm text-zinc-600">{lesson.title}</p>
        <p className="mt-3 text-base text-zinc-800">{taskDescription}</p>
      </div>

      {submissionType === "text" ? (
        <div className="mt-6">
          <HomeworkTextForm
            lessonId={lessonId}
            questions={questions}
            existingSubmission={submission}
          />
        </div>
      ) : (
        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-10 mt-6 rounded-3xl border border-zinc-200/80 bg-white/95 p-4 shadow-[0_8px_32px_-8px_rgba(24,24,27,0.18)] backdrop-blur">
          <p className="text-sm font-semibold text-zinc-900">
            {submission ? "Your homework" : "Record homework"}
          </p>
          <HomeworkSubmissionSection
            lessonId={lessonId}
            submission={submission}
            variant="embedded"
          />
        </div>
      )}

      {catchupReturn ? (
        <div className="mt-4">
          <CatchupReturnButton returnUrl={catchupReturn} />
        </div>
      ) : null}
    </div>
  );
}
