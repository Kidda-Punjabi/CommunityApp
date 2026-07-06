import { LessonFeedbackForm } from "@/components/feedback/lesson-feedback-form";
import { canAccessLessonInContext } from "@/lib/learning/learn-access";
import { loadFeedbackContext } from "@/lib/feedback/load-feedback-context";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ lessonId: string }>;
};

function learnBackHref(requiredTier: string | null | undefined, lessonId: string): string {
  const track =
    requiredTier === "foundational"
      ? "foundational"
      : requiredTier === "beginners"
        ? "beginners"
        : requiredTier === "community"
          ? "community"
          : null;
  const base = track ? `/dashboard/learn/${track}` : "/dashboard/learn";
  return `${base}#lesson-${lessonId}`;
}

export default async function LessonFeedbackPage({ params }: PageProps) {
  const { lessonId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) redirect("/login");

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

  const context = await loadFeedbackContext(supabase, user.id, user.email, {
    lessonId,
    phone: user.phone,
  });

  const backHref = learnBackHref(requiredTier, lessonId);

  return (
    <div className={ui.page}>
      <Link
        href={backHref}
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to lessons
      </Link>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-600">
          Lesson {lesson.lesson_number}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">{lesson.title}</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Feedback for this lesson in {courseName}. Your cohort and tutor are filled in
          automatically.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <LessonFeedbackForm context={context} lessonId={lessonId} />
      </div>
    </div>
  );
}
