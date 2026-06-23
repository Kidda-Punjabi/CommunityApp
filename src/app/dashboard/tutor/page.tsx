import { TutorDashboardOverview } from "@/components/tutor/tutor-dashboard-overview";
import { TutorHomeworkReview } from "@/components/tutor/tutor-homework-review";
import { canAccessTutorDashboard } from "@/lib/tutoring/tutor-access";
import { loadTutorDashboard } from "@/lib/tutoring/load-tutor-dashboard";
import { loadPendingHomeworkReviews } from "@/lib/tutoring/homework-submissions";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function TutorDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const allowed = await canAccessTutorDashboard(supabase, user.id);
  if (!allowed) redirect("/dashboard/profile");

  const [data, pendingHomework] = await Promise.all([
    loadTutorDashboard(supabase, user.id),
    loadPendingHomeworkReviews(supabase),
  ]);

  return (
    <div className={ui.page}>
      <Link
        href="/dashboard/profile"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to profile
      </Link>

      <div className="mb-8 mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          Tutor
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
          Tutor dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Unlock lessons, review homework, and add session recordings for your students.
        </p>
      </div>

      <TutorHomeworkReview submissions={pendingHomework} />

      <TutorDashboardOverview
        foundationalStudents={data.foundationalStudents}
        beginnersOneToOne={data.beginnersOneToOne}
        beginnersGroups={data.beginnersGroups}
      />
    </div>
  );
}
