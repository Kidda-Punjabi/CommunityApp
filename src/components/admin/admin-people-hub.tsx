"use client";

import Link from "next/link";
import { fetchPeopleHubStats } from "@/app/admin/content/people-hub-actions";
import { useAdminData } from "@/app/admin/content/admin-data-provider";
import { AdminFetchErrors } from "@/components/admin/admin-fetch-errors";
import { HubCard } from "@/components/ui/hub-primitives";
import { ui } from "@/lib/ui/styles";
import { useEffect, useState } from "react";

type HubRow = {
  href: string;
  icon: string;
  title: string;
  description: string;
};

export function AdminPeopleHub() {
  const { data } = useAdminData();
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [statsError, setStatsError] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchPeopleHubStats(data.enrollments.length, data.staffMembers.length).then((result) => {
      if (cancelled) return;
      setDescriptions({
        cohorts: result.stats.cohorts,
        members: result.stats.members,
        payments: result.stats.payments,
        discounts: result.stats.discounts,
        staff: result.stats.staff,
      });
      setStatsError(result.error ?? null);
      setLoadingStats(false);
    });
    return () => {
      cancelled = true;
    };
  }, [data.enrollments.length, data.staffMembers.length]);

  const rows: HubRow[] = [
    {
      href: "/admin/content/people/cohorts",
      icon: "👥",
      title: "Cohorts",
      description: descriptions.cohorts ?? (loadingStats ? "Loading…" : "—"),
    },
    {
      href: "/admin/content/people/members",
      icon: "🧑",
      title: "Members",
      description: descriptions.members ?? (loadingStats ? "Loading…" : "—"),
    },
    {
      href: "/admin/content/people/payments",
      icon: "💳",
      title: "Payments",
      description: descriptions.payments ?? "Stripe checkout sessions",
    },
    {
      href: "/admin/content/people/discounts",
      icon: "🏷️",
      title: "Discounts",
      description: descriptions.discounts ?? (loadingStats ? "Loading…" : "—"),
    },
    {
      href: "/admin/content/people/staff",
      icon: "🎓",
      title: "Staff & tutors",
      description: descriptions.staff ?? (loadingStats ? "Loading…" : "—"),
    },
  ];

  return (
    <div className={ui.page}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">People</h1>
        <p className="mt-1 text-sm text-zinc-500">
          View cohorts and allocations, manage members, review discount applications, and assign
          tutors or staff.
        </p>
      </div>

      <AdminFetchErrors errors={data.errors} />

      {statsError ? (
        <p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {statsError}
        </p>
      ) : null}

      <HubCard className="divide-y divide-zinc-100 px-0 py-0">
        {rows.map((row) => (
          <Link
            key={row.href}
            href={row.href}
            className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-zinc-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-lg">
              {row.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-900">{row.title}</p>
              <p className="mt-0.5 text-sm text-zinc-500">{row.description}</p>
            </div>
            <span className="shrink-0 text-lg leading-none text-zinc-400" aria-hidden="true">
              ›
            </span>
          </Link>
        ))}
      </HubCard>
    </div>
  );
}
