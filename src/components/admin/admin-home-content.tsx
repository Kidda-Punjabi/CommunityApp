"use client";

import { fetchAdminDashboard } from "@/app/admin/content/home-actions";
import { fetchAdminTutorOverview } from "@/app/admin/content/tutor-overview-actions";
import { useAdminData } from "@/app/admin/content/admin-data-provider";
import { AdminDashboardGrid } from "@/components/admin/admin-dashboard-cards";
import { AdminFetchErrors } from "@/components/admin/admin-fetch-errors";
import {
  AdminHubLinkCard,
  AdminHubPage,
  AdminHubStack,
} from "@/components/admin/admin-hub-list";
import { AdminStatsBar } from "@/components/admin/admin-stats-bar";
import { formatTutorOverviewSummary } from "@/components/admin/admin-tutor-overview-panel";
import type { AdminDashboardCard } from "@/lib/admin/dashboard/types";
import {
  ArrowLeftRight,
  Gift,
  GraduationCap,
  HelpCircle,
  Sparkles,
  Phone,
  ScrollText,
} from "lucide-react";
import { useEffect, useState } from "react";

export function AdminHomeContent() {
  const { data } = useAdminData();
  const [cards, setCards] = useState<AdminDashboardCard[]>([]);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [tutorCount, setTutorCount] = useState(0);
  const [nearCapacity, setNearCapacity] = useState(0);
  const [loadingTutorSummary, setLoadingTutorSummary] = useState(true);

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

  useEffect(() => {
    let cancelled = false;
    void fetchAdminTutorOverview().then((result) => {
      if (cancelled) return;
      const near = result.tutors.filter((row) => (row.capacityPercent ?? 0) >= 85).length;
      setTutorCount(result.tutors.length);
      setNearCapacity(near);
      setLoadingTutorSummary(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const tutorSummary = formatTutorOverviewSummary(tutorCount, nearCapacity);

  return (
    <AdminHubPage
      title="Admin home"
      description="Operational status first, then the usual shortcuts."
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

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Sections
        </h2>
        <AdminHubStack>
          <AdminHubLinkCard
            href="/admin/cohort-switch-requests"
            icon={<ArrowLeftRight className="h-[18px] w-[18px]" />}
            title="Cohort change requests"
            summary="Approve or decline student requests to join an alternate group session"
          />
          <AdminHubLinkCard
            href="/admin/public-forms"
            icon={<ScrollText className="h-[18px] w-[18px]" />}
            title="Public forms"
            summary="Preview and test every backlog quiz and feedback link, including Week 1 starting point and Week 12"
          />
          <AdminHubLinkCard
            href="/admin/sales-calls"
            icon={<Phone className="h-[18px] w-[18px]" />}
            title="Sales calls"
            summary="Create and edit sales call log entries synced with Notion"
          />
          <AdminHubLinkCard
            href="/admin/monthly-rewards"
            icon={<Gift className="h-[18px] w-[18px]" />}
            title="Monthly Rewards"
            summary="Calculate monthly top 3 and send Prezzee gift cards"
          />
          <AdminHubLinkCard
            href="/admin/content/tutors"
            icon={<GraduationCap className="h-[18px] w-[18px]" />}
            title="Tutor overview"
            summary={loadingTutorSummary ? "Loading tutor summary…" : tutorSummary}
          />
          <AdminHubLinkCard
            href="/admin/content/kids-stories"
            icon={<Sparkles className="h-[18px] w-[18px]" />}
            title="Kids bedtime stories"
            summary="Author Premium kids stories (empty until content is approved)"
          />
          <AdminHubLinkCard
            href="/admin/content/help"
            icon={<HelpCircle className="h-[18px] w-[18px]" />}
            title="Help articles"
            summary="FAQs and SOPs for cohorts, members, curriculum, and payments"
          />
        </AdminHubStack>
      </section>
    </AdminHubPage>
  );
}
