"use client";

import { useState } from "react";
import { useAdminData } from "@/app/admin/content/admin-data-provider";
import { EventsTab } from "@/app/admin/content/components/events-tab";
import { RecommendationsTab } from "@/app/admin/content/components/recommendations-tab";
import { AnnouncementsTab } from "@/app/admin/content/components/announcements-tab";
import { BrandingTab } from "@/app/admin/content/components/branding-tab";
import { StreakDebugTab } from "@/app/admin/content/components/streak-debug-tab";
import { ForumModerationTab } from "@/components/forum/forum-moderation-tab";
import type { ForumReportRow } from "@/lib/forum/types";
import { AdminFetchErrors } from "@/components/admin/admin-fetch-errors";
import { AdminSectionTabs } from "@/components/admin/admin-section-tabs";
import { ui } from "@/lib/ui/styles";

const tabs = [
  { id: "events", label: "Events" },
  { id: "recommendations", label: "Recommendations" },
  { id: "announcements", label: "Announcements" },
  { id: "forum", label: "Forum moderation" },
  { id: "branding", label: "Branding" },
  { id: "streaks", label: "Streak debug" },
] as const;

type TabId = (typeof tabs)[number]["id"];

type AdminSiteSectionProps = {
  forumReports: ForumReportRow[];
};

export function AdminSiteSection({ forumReports }: AdminSiteSectionProps) {
  const { data, branding } = useAdminData();
  const [activeTab, setActiveTab] = useState<TabId>("events");

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Site & comms</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Community events, recommendations, announcements, branding, and debug tools.
        </p>
      </div>

      <AdminFetchErrors errors={data.errors} />
      <AdminSectionTabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

      <div className="mt-6">
        {activeTab === "events" && <EventsTab data={data} />}
        {activeTab === "recommendations" && <RecommendationsTab data={data} />}
        {activeTab === "announcements" && <AnnouncementsTab />}
        {activeTab === "forum" && <ForumModerationTab reports={forumReports} />}
        {activeTab === "branding" && <BrandingTab initialBranding={branding} />}
        {activeTab === "streaks" && <StreakDebugTab />}
      </div>
    </div>
  );
}
