import { ClassDetailView } from "@/components/tutor/class-detail-view";
import { loadCoverTutorChoices } from "@/lib/tutoring/cover-lesson";
import { loadCohortClassDetail } from "@/lib/tutoring/load-tutor-classes";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { CohortLeaderboardCard } from "@/components/leaderboard/cohort-leaderboard-card";
import { loadCohortLeaderboard } from "@/lib/leaderboard/load-cohort-leaderboard";

type CohortPageProps = {
  params: Promise<{ cohortId: string }>;
};

export default async function TutorCohortPage({ params }: CohortPageProps) {
  const { cohortId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { client: admin } = tryCreateServiceRoleClient();
  const reader = admin ?? supabase;
  const [detail, tutors, board] = await Promise.all([
    loadCohortClassDetail(reader, user.id, cohortId),
    loadCoverTutorChoices(reader),
    admin
      ? loadCohortLeaderboard(admin, cohortId).catch((error) => {
          console.error("[tutor] cohort leaderboard failed", error);
          return null;
        })
      : Promise.resolve(null),
  ]);
  if (!detail) notFound();

  return (
    <ClassDetailView
      detail={detail}
      cohortId={cohortId}
      tutors={tutors}
      leaderboard={
        board && board.entries.length > 0 ? <CohortLeaderboardCard board={board} audience="tutor" /> : null
      }
    />
  );
}
