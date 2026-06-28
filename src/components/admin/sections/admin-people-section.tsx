"use client";

import { useState } from "react";
import { useAdminData } from "@/app/admin/content/admin-data-provider";
import { MembersTab } from "@/app/admin/content/components/members-tab";
import { PaymentsTab } from "@/app/admin/content/components/payments-tab";
import { StaffTutorsTab } from "@/app/admin/content/components/staff-tutors-tab";
import { AdminFetchErrors } from "@/components/admin/admin-fetch-errors";
import { AdminSectionTabs } from "@/components/admin/admin-section-tabs";
import { ui } from "@/lib/ui/styles";

const tabs = [
  { id: "members", label: "Members" },
  { id: "payments", label: "Payments" },
  { id: "staff", label: "Staff & tutors" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function AdminPeopleSection() {
  const { data } = useAdminData();
  const [activeTab, setActiveTab] = useState<TabId>("members");

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">People</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage members, view Stripe payments, and assign tutors or staff.
        </p>
      </div>

      <AdminFetchErrors errors={data.errors} />
      <AdminSectionTabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

      <div className="mt-6">
        {activeTab === "members" && <MembersTab data={data} />}
        {activeTab === "payments" && <PaymentsTab />}
        {activeTab === "staff" && <StaffTutorsTab data={data} />}
      </div>
    </div>
  );
}
