"use client";

import { use } from "react";
import { useAdminData } from "@/app/admin/content/admin-data-provider";
import { MemberDetailView } from "@/components/admin/member-detail-view";
import { AdminPeopleSectionShell } from "@/components/admin/admin-people-section-shell";

type AdminMemberDetailPageProps = {
  params: Promise<{ userId: string }>;
};

export default function AdminMemberDetailPage({ params }: AdminMemberDetailPageProps) {
  const { userId } = use(params);
  const { data } = useAdminData();

  return (
    <AdminPeopleSectionShell
      title="Member details"
      backHref="/admin/content/people/members"
      backLabel="Back to Members"
    >
      <MemberDetailView userId={userId} data={data} />
    </AdminPeopleSectionShell>
  );
}
