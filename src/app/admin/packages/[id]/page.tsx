import { notFound } from "next/navigation";
import {
  fetchAdminPackageDetail,
  resolvePackageKind,
} from "@/app/admin/packages/actions";
import { AdminPackageDetailView } from "@/components/admin/packages/admin-package-detail-view";
import { getDisplayName } from "@/lib/profile/display-name";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";

type AdminPackageDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ roster?: string }>;
};

export default async function AdminPackageDetailPage({
  params,
  searchParams,
}: AdminPackageDetailPageProps) {
  const { id } = await params;
  const { roster } = await searchParams;
  const initialRoster =
    roster === "interested" || roster === "confirmed" ? roster : null;
  const kind = await resolvePackageKind(id);
  if (!kind) notFound();

  const { detail, error } = await fetchAdminPackageDetail(kind, id);
  if (!detail) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-red-600">{error ?? "Package not found."}</p>
      </div>
    );
  }

  const supabase = createServiceRoleClient();
  const { data: roleRows } = await supabase
    .from("profile_roles")
    .select("user_id")
    .in("role", ["tutor", "community_lead", "master_admin"]);

  const tutorIds = [...new Set((roleRows ?? []).map((row) => row.user_id))];
  const { data: profileRows } =
    tutorIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, preferred_name")
          .in("id", tutorIds)
      : { data: [] };

  const tutors = (profileRows ?? [])
    .map((profile) => ({
      id: profile.id,
      name: getDisplayName(profile) ?? profile.id.slice(0, 8),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AdminPackageDetailView
      detail={detail}
      tutors={tutors}
      initialRoster={initialRoster}
    />
  );
}
