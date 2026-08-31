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

  const cohortIds = cohorts.map((cohort) => cohort.cohortId);
  const { data: logRows } =
    cohortIds.length > 0
      ? await supabase
          .from("cohort_lesson_log_entries")
          .select("cohort_id, lesson_date, status")
          .in("cohort_id", cohortIds)
          .order("lesson_date", { ascending: false })
      : { data: [] };

  const existingLogs = (logRows ?? [])
    .filter((row) => row.cohort_id && row.lesson_date)
    .map((row) => ({
      cohortId: row.cohort_id as string,
      lessonDate: row.lesson_date as string,
      status: (row.status as string | null) ?? null,
    }));

  return (
    <div className={ui.page}>
      <TutorPageHeader
        title="Log a lesson"
        subtitle="Record a group session after it happens. This updates the Lessons Log in Notion and progress in the app. You do not need to also log the same date in Notion."
      />
      <TutorLogLessonForm
        cohorts={cohorts}
        existingLogs={existingLogs}
        defaultCohortId={defaultCohortId}
      />
    </div>
  );
}
