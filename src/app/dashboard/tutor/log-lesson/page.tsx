import { TutorLogLessonForm } from "@/components/tutor/tutor-log-lesson-form";
import { TutorPageHeader } from "@/components/tutor/tutor-page-header";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { loadTutorDashboard } from "@/lib/tutoring/load-tutor-dashboard";
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
          .select("cohort_id, lesson_date, status, is_cover_session, notion_tutor_user_id")
          .in("cohort_id", cohortIds)
          .order("lesson_date", { ascending: false })
      : { data: [] };

  const { client: adminClient } = tryCreateServiceRoleClient();
  const { data: tutorMapRows } = adminClient
    ? await adminClient
        .from("notion_tutor_map")
        .select("tutor_id, notion_user_id, notion_user_name")
        .order("notion_user_name", { ascending: true })
    : { data: [] };

  const tutors = (tutorMapRows ?? [])
    .filter((row) => row.tutor_id && row.notion_user_id)
    .map((row) => ({
      tutorId: row.tutor_id as string,
      name: (row.notion_user_name as string | null)?.trim() || "Tutor",
    }));
  const tutorIdByNotionUserId = new Map(
    (tutorMapRows ?? [])
      .filter((row) => row.tutor_id && row.notion_user_id)
      .map((row) => [row.notion_user_id as string, row.tutor_id as string])
  );
  const loggerHasNotionTutorMap = (tutorMapRows ?? []).some(
    (row) => row.tutor_id === user!.id
  );

  const existingLogs = (logRows ?? [])
    .filter((row) => row.cohort_id && row.lesson_date)
    .map((row) => ({
      cohortId: row.cohort_id as string,
      lessonDate: row.lesson_date as string,
      status: (row.status as string | null) ?? null,
      isCoverSession: Boolean(row.is_cover_session),
      coverTutorId: row.notion_tutor_user_id
        ? (tutorIdByNotionUserId.get(row.notion_tutor_user_id as string) ?? null)
        : null,
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
        tutors={tutors}
        loggerHasNotionTutorMap={loggerHasNotionTutorMap}
        defaultCohortId={defaultCohortId}
      />
    </div>
  );
}
