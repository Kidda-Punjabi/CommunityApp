import { ClassDetailView } from "@/components/tutor/class-detail-view";
import { loadCoverTutorChoices } from "@/lib/tutoring/cover-lesson";
import { loadCohortClassDetail } from "@/lib/tutoring/load-tutor-classes";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

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
  const [detail, tutors] = await Promise.all([
    loadCohortClassDetail(reader, user.id, cohortId),
    loadCoverTutorChoices(reader),
  ]);
  if (!detail) notFound();

  return <ClassDetailView detail={detail} cohortId={cohortId} tutors={tutors} />;
}
