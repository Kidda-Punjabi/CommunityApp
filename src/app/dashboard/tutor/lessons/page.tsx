import { TutorDashboardOverview } from "@/components/tutor/tutor-dashboard-overview";
import { TutorPageHeader } from "@/components/tutor/tutor-page-header";
import { loadTutorDashboard } from "@/lib/tutoring/load-tutor-dashboard";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";

export default async function TutorLessonsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const data = await loadTutorDashboard(supabase, user!.id);

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
