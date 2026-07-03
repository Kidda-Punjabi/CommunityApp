"use client";

import { useAdminData } from "@/app/admin/content/admin-data-provider";
import { MembersTab } from "@/app/admin/content/components/members-tab";
import { AdminPeopleSectionShell } from "@/components/admin/admin-people-section-shell";

export default function AdminPeopleMembersPage() {
  const { data } = useAdminData();

  return (
    <AdminPeopleSectionShell title="Members">
      <MembersTab data={data} />
    </AdminPeopleSectionShell>
  );
}
