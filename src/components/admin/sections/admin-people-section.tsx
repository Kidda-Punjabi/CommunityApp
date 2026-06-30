"use client";

import { useEffect, useState } from "react";
import { useAdminData } from "@/app/admin/content/admin-data-provider";
import { CohortsTab } from "@/app/admin/content/components/cohorts-tab";
import { StudentDiscountsTab } from "@/app/admin/content/components/student-discounts-tab";
import { MembersTab } from "@/app/admin/content/components/members-tab";
import { PaymentsTab } from "@/app/admin/content/components/payments-tab";
import { StaffTutorsTab } from "@/app/admin/content/components/staff-tutors-tab";
import { AdminFetchErrors } from "@/components/admin/admin-fetch-errors";
import { AdminSectionTabs } from "@/components/admin/admin-section-tabs";
import { ui } from "@/lib/ui/styles";

const tabs = [
  { id: "cohorts", label: "Cohorts" },
  { id: "members", label: "Members" },
  { id: "payments", label: "Payments" },
  { id: "student-discounts", label: "Discounts" },
  { id: "staff", label: "Staff & tutors" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const TAB_IDS = new Set<string>(tabs.map((tab) => tab.id));

function parseTabId(value: string | undefined): TabId {
  if (value && TAB_IDS.has(value)) {
    return value as TabId;
  }
  return "cohorts";
}

type AdminPeopleSectionProps = {
  initialTab?: string;
};

export function AdminPeopleSection({ initialTab }: AdminPeopleSectionProps) {
  const { data } = useAdminData();
  const [activeTab, setActiveTab] = useState<TabId>(() => parseTabId(initialTab));

  useEffect(() => {
    setActiveTab(parseTabId(initialTab));
  }, [initialTab]);

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">People</h1>
        <p className="mt-1 text-sm text-zinc-500">
          View cohorts and allocations, manage members, review discount applications, and assign
          tutors or staff.
        </p>
      </div>

      <AdminFetchErrors errors={data.errors} />
      <AdminSectionTabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

      <div className="mt-6">
        {activeTab === "cohorts" && <CohortsTab />}
        {activeTab === "members" && <MembersTab data={data} />}
        {activeTab === "payments" && <PaymentsTab />}
        {activeTab === "student-discounts" && <StudentDiscountsTab />}
        {activeTab === "staff" && <StaffTutorsTab data={data} />}
      </div>
    </div>
  );
}
