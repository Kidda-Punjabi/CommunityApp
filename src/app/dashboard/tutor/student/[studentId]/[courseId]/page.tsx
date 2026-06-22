import { TutorLessonManager } from "@/components/tutor/tutor-lesson-manager";
import { canAccessTutorDashboard } from "@/lib/tutoring/tutor-access";
import { loadTutorStudentLessons } from "@/lib/tutoring/load-tutor-dashboard";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type TutorStudentPageProps = {
  params: Promise<{ studentId: string; courseId: string }>;
};

export default async function TutorStudentPage({ params }: TutorStudentPageProps) {
  const { studentId, courseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const allowed = await canAccessTutorDashboard(supabase, user.id);
  if (!allowed) redirect("/dashboard/profile");

  const data = await loadTutorStudentLessons(supabase, user.id, studentId, courseId);
  if (!data) notFound();

  return (
    <div className={ui.page}>
      <Link
        href="/dashboard/tutor"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to tutor dashboard
      </Link>

      <div className="mb-8 mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          {data.courseName}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
          {data.studentName}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">1-1 student · unlock lessons individually</p>
      </div>

      <TutorLessonManager
        lessons={data.lessons}
        scope={{ mode: "student", studentId, courseId }}
        scopeLabel={data.studentName}
      />
    </div>
  );
}
