"use client";

import { useAdminData } from "@/app/admin/content/admin-data-provider";
import { StaffTutorsTab } from "@/app/admin/content/components/staff-tutors-tab";
import { AdminPeopleSectionShell } from "@/components/admin/admin-people-section-shell";

export default function AdminPeopleStaffPage() {
  const { data } = useAdminData();

  return (
    <AdminPeopleSectionShell title="Staff & tutors">
      <StaffTutorsTab data={data} />
    </AdminPeopleSectionShell>
  );
}
