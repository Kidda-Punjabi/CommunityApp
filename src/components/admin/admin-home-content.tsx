"use client";

import { fetchAdminDashboard } from "@/app/admin/content/home-actions";
import { useAdminData } from "@/app/admin/content/admin-data-provider";
import { AdminAcquisitionDashboard } from "@/components/admin/acquisition/admin-acquisition-dashboard";
import { AdminDashboardGrid } from "@/components/admin/admin-dashboard-cards";
import { AdminFetchErrors } from "@/components/admin/admin-fetch-errors";
import { AdminHubPage } from "@/components/admin/admin-hub-list";
import { AdminSectionTabs } from "@/components/admin/admin-section-tabs";
import type { AdminDashboardCard } from "@/lib/admin/dashboard/types";
import { useEffect, useState } from "react";

const HOME_TABS = [
  { id: "acquisition", label: "Acquisition" },
  { id: "operations", label: "Operations" },
  { id: "delivery", label: "Delivery" },
] as const;

type HomeTabId = (typeof HOME_TABS)[number]["id"];

function ComingSoonPanel() {
  return (
    <div className="rounded-[12px] border-[0.5px] border-zinc-200 bg-white px-4 py-12 text-center">
      <p className="text-sm font-medium text-zinc-900">Coming soon</p>
      <p className="mt-1 text-sm text-zinc-500">Metrics for this area are not available yet.</p>
    </div>
  );
}

export function AdminHomeContent() {
  const { data } = useAdminData();
  const [activeTab, setActiveTab] = useState<HomeTabId>("operations");
  const [cards, setCards] = useState<AdminDashboardCard[]>([]);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchAdminDashboard().then((result) => {
      if (cancelled) return;
      setCards(result.cards);
      setDashboardError(result.error ?? null);
      setLoadingDashboard(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminHubPage
      title="Admin home"
      description="Acquisition, operations, and delivery."
    >
      <AdminFetchErrors errors={data.errors} />

      <AdminSectionTabs
        tabs={HOME_TABS}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as HomeTabId)}
      />

      <div className="mt-6">
        {activeTab === "operations" ? (
          <>
            {dashboardError ? (
              <p className="mb-6 rounded-[12px] border-[0.5px] border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {dashboardError}
              </p>
            ) : null}
            <AdminDashboardGrid cards={cards} loading={loadingDashboard} />
          </>
        ) : activeTab === "acquisition" ? (
          <AdminAcquisitionDashboard />
        ) : (
          <ComingSoonPanel />
        )}
      </div>
    </AdminHubPage>
  );
}
