"use client";

import { CohortsTab } from "@/app/admin/content/components/cohorts-tab";
import { AdminPeopleSectionShell } from "@/components/admin/admin-people-section-shell";

export default function AdminPeopleCohortsPage() {
  return (
    <AdminPeopleSectionShell title="Cohorts">
      <CohortsTab />
    </AdminPeopleSectionShell>
  );
}
