"use client";

import { fetchCeoSnapshot, refreshCeoSnapshot } from "@/app/admin/ceo/actions";
import { fetchAdminDashboard } from "@/app/admin/content/home-actions";
import { useAdminData } from "@/app/admin/content/admin-data-provider";
import { AdminAcquisitionDashboard } from "@/components/admin/acquisition/admin-acquisition-dashboard";
import { AdminSalesReportPanel } from "@/components/admin/acquisition/admin-sales-report-panel";
import { AdminDashboardGrid } from "@/components/admin/admin-dashboard-cards";
import { CeoMetricGrid } from "@/components/admin/ceo/ceo-metric-card";
import { AdminDeliverySection } from "@/components/admin/delivery/admin-delivery-section";
import { AdminFetchErrors } from "@/components/admin/admin-fetch-errors";
import { AdminHubPage } from "@/components/admin/admin-hub-list";
import { AdminSectionTabs } from "@/components/admin/admin-section-tabs";
import type { AdminDashboardCard } from "@/lib/admin/dashboard/types";
import type { CeoArea, CeoSnapshot } from "@/lib/admin/ceo/types";
import { useEffect, useState } from "react";

const HOME_TABS = [
  { id: "overview", label: "Overview" },
  { id: "acquisition", label: "Acquisition" },
  { id: "operations", label: "Operations" },
  { id: "delivery", label: "Delivery" },
] as const;

type HomeTabId = (typeof HOME_TABS)[number]["id"];

const AREA_TITLE: Record<CeoArea, string> = {
  acquisition: "Acquisition",
  operations: "Operations",
  delivery: "Delivery",
};

function AreaData({
  area,
  snapshot,
  onSnapshot,
}: {
  area: CeoArea;
  snapshot: CeoSnapshot | null;
  onSnapshot: (snapshot: CeoSnapshot) => void;
}) {
  const metrics = (snapshot?.metrics ?? [])
    .filter((metric) => metric.area === area)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <section>
      <h2 className="font-heading text-[17px] font-semibold text-zinc-900">Data</h2>
      <p className="mt-1 text-sm text-zinc-500">
        {snapshot
          ? `${snapshot.periodStart} to ${snapshot.periodEnd}. Saved ${new Date(snapshot.createdAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}.`
          : "Refresh Overview to fill these figures. The lists below are unchanged."}
      </p>
      {metrics.length > 0 ? (
        <div className="mt-4">
          <CeoMetricGrid metrics={metrics} onSnapshot={onSnapshot} />
        </div>
      ) : null}
    </section>
  );
}

export function AdminHomeContent() {
  const { data } = useAdminData();
  const [activeTab, setActiveTab] = useState<HomeTabId>("overview");
  const [cards, setCards] = useState<AdminDashboardCard[]>([]);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [snapshot, setSnapshot] = useState<CeoSnapshot | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function load() {
      void fetchAdminDashboard().then((result) => {
        if (cancelled) return;
        setCards(result.cards);
        setDashboardError(result.error ?? null);
        setLoadingDashboard(false);
      });
    }

    function loadOverview() {
      void fetchCeoSnapshot().then((result) => {
        if (cancelled) return;
        setSnapshot(result.snapshot);
        setOverviewError(result.error ?? null);
      });
    }

    load();
    loadOverview();

    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      load();
      loadOverview();
    }

    window.addEventListener("pageshow", onPageShow);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  const opsActions = cards.filter((card) => card.count > 0).length;
  const badges = {
    acquisition:
      (snapshot?.actions.stripeMissing ?? 0) +
      (snapshot?.actions.callsNoOutcome ?? 0) +
      (snapshot?.actions.cohortsNotFull ?? 0),
    operations: opsActions,
    delivery: snapshot?.actions.deliveryFollowUps ?? 0,
  };

  async function refreshOverview() {
    setRefreshing(true);
    setOverviewError(null);
    const result = await refreshCeoSnapshot();
    setRefreshing(false);
    if (result.snapshot) setSnapshot(result.snapshot);
    if (result.error) setOverviewError(result.error);
  }

  return (
    <AdminHubPage
      title="Admin home"
      description="Overview, acquisition, operations, and delivery."
    >
      <AdminFetchErrors errors={data.errors} />

      <AdminSectionTabs
        tabs={HOME_TABS}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as HomeTabId)}
        badges={badges}
      />

      <div className="mt-6">
        {activeTab === "overview" ? (
          <div className="space-y-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-[17px] font-semibold text-zinc-900">Overview</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {snapshot
                    ? `Last 30 days, ${snapshot.periodStart} to ${snapshot.periodEnd}.`
                    : "Last 30 days. Refresh to take the first snapshot."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refreshOverview()}
                disabled={refreshing}
                className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {refreshing ? "Refreshing" : "Refresh"}
              </button>
            </div>
            {overviewError ? (
              <p className="rounded-[12px] border-[0.5px] border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {overviewError}
              </p>
            ) : null}
            {snapshot ? (
              (["acquisition", "operations", "delivery"] as const).map((area) => (
                <section key={area}>
                  <h3 className="mb-3 font-heading text-[15px] font-semibold text-zinc-900">{AREA_TITLE[area]}</h3>
                  <CeoMetricGrid
                    metrics={snapshot.metrics
                      .filter((metric) => metric.area === area)
                      .sort((a, b) => a.sortOrder - b.sortOrder)}
                    onSnapshot={setSnapshot}
                  />
                </section>
              ))
            ) : overviewError ? null : (
              <p className="text-sm text-zinc-500">No snapshot yet.</p>
            )}
          </div>
        ) : activeTab === "operations" ? (
          <div className="space-y-8">
            <AreaData area="operations" snapshot={snapshot} onSnapshot={setSnapshot} />
            <section>
              <h2 className="mb-4 font-heading text-[17px] font-semibold text-zinc-900">Actions</h2>
              {dashboardError ? (
                <p className="mb-6 rounded-[12px] border-[0.5px] border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {dashboardError}
                </p>
              ) : null}
              <AdminDashboardGrid cards={cards} loading={loadingDashboard} />
            </section>
          </div>
        ) : activeTab === "acquisition" ? (
          <div className="space-y-8">
            <AreaData area="acquisition" snapshot={snapshot} onSnapshot={setSnapshot} />
            <section className="space-y-6">
              <h2 className="font-heading text-[17px] font-semibold text-zinc-900">Actions</h2>
              <ul className="space-y-2 text-sm text-zinc-700">
                <li>Stripe payments missing from the sales call log: {snapshot?.actions.stripeMissing ?? "n/a"}</li>
                <li>Past calls with no outcome: {snapshot?.actions.callsNoOutcome ?? "n/a"}</li>
                <li>Recruiting cohorts starting within 14 days that are not full: {snapshot?.actions.cohortsNotFull ?? "n/a"}</li>
              </ul>
              <AdminSalesReportPanel />
              <AdminAcquisitionDashboard />
            </section>
          </div>
        ) : activeTab === "delivery" ? (
          <div className="space-y-8">
            <AreaData area="delivery" snapshot={snapshot} onSnapshot={setSnapshot} />
            <section>
              <h2 className="mb-4 font-heading text-[17px] font-semibold text-zinc-900">Actions</h2>
              <AdminDeliverySection />
            </section>
          </div>
        ) : null}
      </div>
    </AdminHubPage>
  );
}
