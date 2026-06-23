import { TutorAttendanceSection } from "@/components/tutor/tutor-attendance-section";
import { TutorPageHeader } from "@/components/tutor/tutor-page-header";
import { loadTutorDashboard } from "@/lib/tutoring/load-tutor-dashboard";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";

export default async function TutorAttendancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const data = await loadTutorDashboard(supabase, user!.id);

  return (
    <div className={ui.page}>
      <TutorPageHeader
        title="Attendance"
        subtitle="Mark present or absent for each student after a group live session."
      />

      {data.beginnersGroups.length === 0 ? (
        <div className={ui.emptyState}>
          <span className="text-5xl" role="img" aria-hidden="true">
            👥
          </span>
          <p className="mt-4 text-lg font-semibold text-zinc-900">No group cohorts</p>
          <p className="mt-2 text-sm text-zinc-500">
            Attendance tracking is for group classes only. 1-1 lesson unlocks already
            imply the student attended.
          </p>
        </div>
      ) : (
        <TutorAttendanceSection cohorts={data.beginnersGroups} fullPage />
      )}
    </div>
  );
}
