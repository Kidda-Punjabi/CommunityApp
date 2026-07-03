"use client";

import { PaymentsTab } from "@/app/admin/content/components/payments-tab";
import { AdminPeopleSectionShell } from "@/components/admin/admin-people-section-shell";

export default function AdminPeoplePaymentsPage() {
  return (
    <AdminPeopleSectionShell title="Payments">
      <PaymentsTab />
    </AdminPeopleSectionShell>
  );
}
