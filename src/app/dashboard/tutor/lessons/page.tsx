import { TutorDashboardOverview } from "@/components/tutor/tutor-dashboard-overview";
import { TutorPageHeader } from "@/components/tutor/tutor-page-header";
import { getCachedTutorDashboard } from "@/lib/cache/tab-page-cache";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

export default async function TutorLessonsPage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const data = await getCachedTutorDashboard(session.user.id);

  return (
    <div className={ui.page}>
      <TutorPageHeader
        title="Lessons"
        subtitle="Unlock lesson content and add session recording links for your students."
      />
      <TutorDashboardOverview
        foundationalStudents={data.foundationalStudents}
        beginnersOneToOne={data.beginnersOneToOne}
        beginnersGroups={data.beginnersGroups}
      />
    </div>
  );
}
