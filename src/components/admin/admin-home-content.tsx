"use client";

import Link from "next/link";
import { fetchAdminHomeAttention, type AdminAttentionItem } from "@/app/admin/content/home-actions";
import { fetchAdminTutorOverview } from "@/app/admin/content/tutor-overview-actions";
import { useAdminData } from "@/app/admin/content/admin-data-provider";
import { AdminFetchErrors } from "@/components/admin/admin-fetch-errors";
import { AdminStatsBar } from "@/components/admin/admin-stats-bar";
import { formatTutorOverviewSummary } from "@/components/admin/admin-tutor-overview-panel";
import { HubCard } from "@/components/ui/hub-primitives";
import { ui } from "@/lib/ui/styles";
import { useEffect, useState } from "react";

export function AdminHomeContent() {
  const { data } = useAdminData();
  const [attentionItems, setAttentionItems] = useState<AdminAttentionItem[]>([]);
  const [attentionError, setAttentionError] = useState<string | null>(null);
  const [loadingAttention, setLoadingAttention] = useState(true);
  const [tutorCount, setTutorCount] = useState(0);
  const [nearCapacity, setNearCapacity] = useState(0);
  const [loadingTutorSummary, setLoadingTutorSummary] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchAdminHomeAttention().then((result) => {
      if (cancelled) return;
      setAttentionItems(result.items);
      setAttentionError(result.error ?? null);
      setLoadingAttention(false);
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

  const showAttention = !loadingAttention && attentionItems.length > 0;

  return (
    <div className={ui.page}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Admin home</h1>
        <p className="mt-1 text-sm text-zinc-500">
          At-a-glance stats, items that need action, and quick links.
        </p>
      </div>

      <AdminFetchErrors errors={data.errors} />

      <div className="mb-8">
        <AdminStatsBar
          courses={data.courses.length}
          membersEnrolled={data.enrollments.length}
          cohorts={data.cohorts.length}
          staff={data.staffMembers.length}
        />
      </div>

      {attentionError ? (
        <p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {attentionError}
        </p>
      ) : null}

      {showAttention ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Needs attention
          </h2>
          <HubCard className="divide-y divide-zinc-100 px-0 py-0">
            {attentionItems.map((item) => (
              <AttentionRow key={item.id} item={item} />
            ))}
          </HubCard>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Sections
        </h2>
        <HubCard className="divide-y divide-zinc-100 px-6 py-0">
          <AdminNavListRow
            href="/admin/cohort-switch-requests"
            title="Cohort change requests"
            description="Approve or decline student requests to join an alternate group session"
          />
          <AdminNavListRow
            href="/admin/sales-calls"
            title="Sales calls"
            description="Create and edit sales call log entries synced with Notion"
          />
          <AdminNavListRow
            href="/admin/monthly-rewards"
            title="Monthly Rewards"
            description="Calculate monthly top 3 and send Prezzee gift cards"
          />
          <AdminNavListRow
            href="/admin/content/tutors"
            title="Tutor overview"
            description={
              loadingTutorSummary
                ? "Loading tutor summary…"
                : tutorSummary
            }
          />
          <AdminNavListRow
            href="/admin/tutor-hours"
            title="Tutor hours"
            description="Lesson hours plus tagged Kidda meeting, admin, and prep — informational only"
          />
          <AdminNavListRow
            href="/admin/content/kids-stories"
            title="Kids bedtime stories"
            description="Author Premium kids stories (empty until content is approved)"
          />
          <AdminNavListRow
            href="/admin/content/help"
            title="Help articles"
            description="FAQs and SOPs for cohorts, members, curriculum, and payments"
          />
        </HubCard>
      </section>
    </div>
  );
}

function AttentionRow({ item }: { item: AdminAttentionItem }) {
  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-zinc-50"
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          item.urgent ? "bg-red-500" : "bg-zinc-300"
        }`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900">{item.title}</p>
        <p className="mt-0.5 text-sm text-zinc-500">{item.detail}</p>
      </div>
      <span className="shrink-0 text-lg leading-none text-zinc-400" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}

function AdminNavListRow({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-violet-600"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900">{title}</p>
        <p className="mt-0.5 text-sm text-zinc-500">{description}</p>
      </div>
      <span className="shrink-0 text-lg leading-none text-zinc-400" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
