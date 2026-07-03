"use client";

import { StudentDiscountsTab } from "@/app/admin/content/components/student-discounts-tab";
import { AdminPeopleSectionShell } from "@/components/admin/admin-people-section-shell";

export default function AdminPeopleDiscountsPage() {
  return (
    <AdminPeopleSectionShell title="Discounts">
      <StudentDiscountsTab />
    </AdminPeopleSectionShell>
  );
}
