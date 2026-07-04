"use client";

import { useState } from "react";
import { useAdminData } from "@/app/admin/content/admin-data-provider";
import { SentenceBuilderTab } from "@/app/admin/content/components/sentence-builder-tab";
import { ConjugationTab } from "@/app/admin/content/components/conjugation-tab";
import { ComprehensionTab } from "@/app/admin/content/components/comprehension-tab";
import { GenderSortTab } from "@/app/admin/content/components/gender-sort-tab";
import { AdminContentSubNav } from "@/components/admin/admin-content-sub-nav";
import { AdminFetchErrors } from "@/components/admin/admin-fetch-errors";
import { AdminSectionTabs } from "@/components/admin/admin-section-tabs";
import { ui } from "@/lib/ui/styles";

const tabs = [
  { id: "sentence-builder", label: "Sentence builder" },
  { id: "conjugation", label: "Conjugation" },
  { id: "gender-sort", label: "Gender sort" },
  { id: "comprehension", label: "Comprehension" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function AdminGamesSection() {
  const { data } = useAdminData();
  const [activeTab, setActiveTab] = useState<TabId>("sentence-builder");

  return (
    <div className={ui.page}>
      <AdminContentSubNav />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Games</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Content for practice games and interactive activities.
        </p>
      </div>

      <AdminFetchErrors errors={data.errors} />
      <AdminSectionTabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

      <div className="mt-6">
        {activeTab === "sentence-builder" && <SentenceBuilderTab data={data} />}
        {activeTab === "conjugation" && <ConjugationTab data={data} />}
        {activeTab === "gender-sort" && <GenderSortTab data={data} />}
        {activeTab === "comprehension" && <ComprehensionTab />}
      </div>
    </div>
  );
}
