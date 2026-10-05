import { ClassDetailView } from "@/components/tutor/class-detail-view";
import { loadCoverTutorChoices } from "@/lib/tutoring/cover-lesson";
import { loadPackageClassDetail } from "@/lib/tutoring/load-tutor-classes";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

type StudentClassPageProps = {
  params: Promise<{ packageInstanceId: string }>;
};

export default async function TutorStudentClassPage({ params }: StudentClassPageProps) {
  const { packageInstanceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { client: admin } = tryCreateServiceRoleClient();
  const reader = admin ?? supabase;
  const [detail, tutors] = await Promise.all([
    loadPackageClassDetail(reader, user.id, packageInstanceId),
    loadCoverTutorChoices(reader),
  ]);
  if (!detail) notFound();

  return <ClassDetailView detail={detail} packageInstanceId={packageInstanceId} tutors={tutors} />;
}
