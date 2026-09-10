"use client";

import { fetchAdminDashboard } from "@/app/admin/content/home-actions";
import { useAdminData } from "@/app/admin/content/admin-data-provider";
import { AdminDashboardGrid } from "@/components/admin/admin-dashboard-cards";
import { AdminFetchErrors } from "@/components/admin/admin-fetch-errors";
import { AdminHubPage } from "@/components/admin/admin-hub-list";
import { AdminStatsBar } from "@/components/admin/admin-stats-bar";
import type { AdminDashboardCard } from "@/lib/admin/dashboard/types";
import { useEffect, useState } from "react";

export function AdminHomeContent() {
  const { data } = useAdminData();
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
      description="Operational status for requests, enrollment, and ops."
    >
      <AdminFetchErrors errors={data.errors} />

      {dashboardError ? (
        <p className="mb-6 rounded-[12px] border-[0.5px] border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {dashboardError}
        </p>
      ) : null}

      <section className="mb-8">
        {loadingDashboard ? (
          <p className="text-[13px] text-zinc-500">Loading live status…</p>
        ) : (
          <AdminDashboardGrid cards={cards} />
        )}
      </section>

      <div className="mb-8">
        <AdminStatsBar
          courses={data.courses.length}
          membersEnrolled={data.enrollments.length}
          cohorts={data.cohorts.length}
          staff={data.staffMembers.length}
        />
      </div>
    </AdminHubPage>
  );
}
