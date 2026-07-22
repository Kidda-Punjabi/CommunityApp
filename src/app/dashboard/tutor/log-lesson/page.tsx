import { TutorLogLessonForm } from "@/components/tutor/tutor-log-lesson-form";
import { TutorPageHeader } from "@/components/tutor/tutor-page-header";
import { loadTutorDashboard } from "@/lib/tutoring/load-tutor-dashboard";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";

type TutorLogLessonPageProps = {
  searchParams: Promise<{ cohortId?: string }>;
};

export default async function TutorLogLessonPage({ searchParams }: TutorLogLessonPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const data = await loadTutorDashboard(supabase, user!.id);
  const cohorts = data.beginnersGroups.map((cohort) => ({
    cohortId: cohort.cohortId,
    cohortName: cohort.cohortName,
    courseName: cohort.courseName,
  }));

  const defaultCohortId =
    params.cohortId && cohorts.some((c) => c.cohortId === params.cohortId)
      ? params.cohortId
      : null;

  return (
    <div className={ui.page}>
      <TutorPageHeader
        title="Log a lesson"
        subtitle="Record a group session after it happens. This creates a Lessons Log entry in Notion and updates progress in the app."
      />
      <TutorLogLessonForm cohorts={cohorts} defaultCohortId={defaultCohortId} />
    </div>
  );
}
