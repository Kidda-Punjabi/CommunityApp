import { NavLink } from "@/components/ui/nav-link";
import {
  fetchAccessibleLearnEnglishCourseById,
  filterLessonsForPrivateCourse,
} from "@/lib/learning/private-courses";
import { fetchLearnContent } from "@/lib/learning/load-learn-content";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import { notFound, redirect } from "next/navigation";

type EnglishLearnCoursePageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function EnglishLearnCoursePage({
  params,
}: EnglishLearnCoursePageProps) {
  const { courseId } = await params;
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const course = await fetchAccessibleLearnEnglishCourseById(
    session.supabase,
    session.user.id,
    courseId
  );

  if (!course) notFound();

  if (course.lessonCount <= 0) {
    return (
      <div className={ui.page}>
        <div className="mb-6">
          <NavLink
            href="/dashboard/english/learn"
            className="text-sm font-medium text-emerald-700 hover:text-emerald-600"
          >
            ← Back to Learn
          </NavLink>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">
            {course.name}
          </h1>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-6 py-10 text-center">
          <p className="text-base font-semibold text-emerald-950">Coming soon</p>
          <p className="mt-2 text-sm text-emerald-800/90">
            Lessons for this course are being added week by week. Check back soon —
            nothing&apos;s broken, content just hasn&apos;t landed yet.
          </p>
        </div>
      </div>
    );
  }

  const allLessons = await fetchLearnContent(session.supabase);
  const lessons = filterLessonsForPrivateCourse(allLessons, course.id);

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <NavLink
          href="/dashboard/english/learn"
          className="text-sm font-medium text-emerald-700 hover:text-emerald-600"
        >
          ← Back to Learn
        </NavLink>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">
          {course.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          {lessons.length} lesson{lessons.length === 1 ? "" : "s"} in this course.
        </p>
      </div>

      <ul className="space-y-2">
        {lessons.map((lesson) => (
          <li key={lesson.id}>
            <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
              <p className="text-sm font-medium text-zinc-900">
                Week {lesson.lesson_number}: {lesson.title}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
