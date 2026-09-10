import { AdminCohortChangeRequestDetail } from "@/components/admin/cohort-change/admin-cohort-change-request-detail";

export default async function AdminCohortChangeRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminCohortChangeRequestDetail requestId={id} />;
}
