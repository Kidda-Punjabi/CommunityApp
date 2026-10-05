import { TutorDashboardOverview } from "@/components/tutor/tutor-dashboard-overview";
import { TutorPageHeader } from "@/components/tutor/tutor-page-header";
import { isTestClassName } from "@/lib/tutoring/log-lesson-copy";
import { getTutorDashboardData } from "@/lib/cache/tab-page-cache";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

export default async function TutorLessonsPage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const data = await getTutorDashboardData(session.user.id);

  return (
    <div className={ui.page}>
      <TutorPageHeader
        title="Lessons"
        subtitle="Unlock lesson content and add session recording links for your students."
      />
      <TutorDashboardOverview
        foundationalStudents={data.foundationalStudents.filter((student) => !isTestClassName(student.studentName))}
        beginnersOneToOne={data.beginnersOneToOne.filter((student) => !isTestClassName(student.studentName))}
        beginnersGroups={data.beginnersGroups.filter((cohort) => !isTestClassName(cohort.cohortName))}
      />
    </div>
  );
}
