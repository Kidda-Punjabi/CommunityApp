import { EnglishMockTest } from "@/components/english/english-mock-test";
import { NavLink } from "@/components/ui/nav-link";
import { getEnglishExamCourseConfig } from "@/lib/learning/english-exam-courses";
import { loadEnglishExamQuestions } from "@/lib/learning/load-english-exam-content";
import { fetchAccessibleLearnEnglishCourseById } from "@/lib/learning/private-courses";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import { notFound, redirect } from "next/navigation";

type MockPageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function EnglishExamMockPage({ params }: MockPageProps) {
  const { courseId } = await params;
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const course = await fetchAccessibleLearnEnglishCourseById(
    session.supabase,
    session.user.id,
    courseId
  );
  const config = course ? getEnglishExamCourseConfig(course.name) : null;
  if (!course || !config) notFound();

  const questions = await loadEnglishExamQuestions(session.supabase, course.id);

  return (
    <div className={ui.page}>
      <NavLink
        href={`/dashboard/english/learn/${course.id}`}
        className="mb-4 text-sm font-medium text-emerald-700 hover:text-emerald-600"
      >
        ← Back to {course.name}
      </NavLink>

      <EnglishMockTest
        courseId={course.id}
        courseName={course.name}
        config={config}
        bank={questions}
      />
    </div>
  );
}
