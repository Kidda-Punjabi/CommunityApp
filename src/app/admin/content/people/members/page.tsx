"use client";

import { useAdminData } from "@/app/admin/content/admin-data-provider";
import { MembersTab } from "@/app/admin/content/components/members-tab";
import { AdminLeadLinkSummary } from "@/components/admin/admin-lead-link-summary";
import { AdminPeopleSectionShell } from "@/components/admin/admin-people-section-shell";

export default function AdminPeopleMembersPage() {
  const { data } = useAdminData();

  return (
    <AdminPeopleSectionShell title="Members">
      <AdminLeadLinkSummary />
      <MembersTab data={data} />
    </AdminPeopleSectionShell>
  );
}
