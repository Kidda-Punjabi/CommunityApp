"use client";

import { fetchCohortsOverview } from "@/app/admin/content/cohort-overview-actions";
import {
  packageStatusLabel,
  type CohortOverview,
  type CohortsOverviewData,
} from "@/lib/admin/load-cohorts-overview";
import { ui } from "@/lib/ui/styles";
import { useEffect, useState } from "react";
import { SectionCard } from "./ui";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function StatusPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "amber" | "zinc" | "violet";
}) {
  const tones = {
    green: "bg-green-50 text-green-800",
    amber: "bg-amber-50 text-amber-800",
    zinc: "bg-zinc-100 text-zinc-600",
    violet: "bg-violet-50 text-violet-800",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function memberSetupStatus(member: CohortOverview["members"][number]) {
  if (!member.hasEnrollment) {
    return <StatusPill tone="amber">Needs enrollment</StatusPill>;
  }
  if (member.packageStatus === "pending_setup") {
    return <StatusPill tone="amber">Pending setup</StatusPill>;
  }
  if (member.packageStatus === "active") {
    return <StatusPill tone="green">Active</StatusPill>;
  }
  if (member.packageStatus) {
    return <StatusPill tone="zinc">{packageStatusLabel(member.packageStatus)}</StatusPill>;
  }
  return <StatusPill tone="zinc">No package row</StatusPill>;
}

function CohortCard({ cohort }: { cohort: CohortOverview }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cohort.active ? ui.card : ui.cardBordered}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-zinc-900">{cohort.name}</h3>
            {!cohort.active && <StatusPill tone="zinc">Inactive</StatusPill>}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {cohort.courseName}
            {cohort.tutorLabel ? ` · Tutor: ${cohort.tutorLabel}` : " · No tutor assigned"}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Created {formatDate(cohort.createdAt)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold text-violet-600">{cohort.memberCount}</p>
          <p className="text-xs font-medium text-zinc-500">
            {cohort.memberCount === 1 ? "student" : "students"}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 border-t border-zinc-100 pt-4">
          {cohort.members.length === 0 ? (
            <p className="text-sm text-zinc-500">No students allocated yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {cohort.members.map((member) => (
                <li
                  key={member.userId}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900">{member.label}</p>
                    {member.email && (
                      <p className="truncate text-sm text-zinc-500">{member.email}</p>
                    )}
                    <p className="mt-0.5 text-xs text-zinc-400">
                      Joined {formatDate(member.joinedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">{memberSetupStatus(member)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function StatsRow({ data }: { data: CohortsOverviewData }) {
  const items = [
    { label: "Active cohorts", value: data.stats.activeCohorts },
    { label: "Allocated to cohorts", value: data.stats.totalAllocated },
    { label: "Group — awaiting cohort", value: data.stats.unallocatedGroup },
    { label: "1-to-1 beginners", value: data.stats.oneToOneBeginners },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className={ui.statCard}>
          <p className="text-2xl font-bold text-violet-600">{item.value}</p>
          <p className="mt-1 text-xs font-medium text-zinc-500">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

export function CohortsTab() {
  const [data, setData] = useState<CohortsOverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchCohortsOverview().then((result) => {
      if (cancelled) return;
      setData(result.data);
      setError(result.error ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading cohorts…</p>;
  }

  if (error && !data) {
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {error}
      </p>
    );
  }

  if (!data) {
    return <p className="text-sm text-zinc-500">No cohort data available.</p>;
  }

  const activeCohorts = data.cohorts.filter((c) => c.active);
  const pastCohorts = data.cohorts.filter((c) => !c.active);

  return (
    <div className="space-y-8">
      <StatsRow data={data} />

      {data.unallocatedGroupBuyers.length > 0 && (
        <SectionCard title={`Group purchases awaiting cohort (${data.unallocatedGroupBuyers.length})`}>
          <p className="mb-4 text-sm text-zinc-600">
            These students bought the group beginners course but are not in a cohort yet. Assign them
            in the Members tab under Beginners setup.
          </p>
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {data.unallocatedGroupBuyers.map((buyer) => (
              <li
                key={buyer.userId}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-zinc-900">{buyer.label}</p>
                  {buyer.email && <p className="text-sm text-zinc-500">{buyer.email}</p>}
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Purchased {formatDate(buyer.purchasedAt)}
                  </p>
                </div>
                <StatusPill tone="amber">{packageStatusLabel(buyer.packageStatus)}</StatusPill>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <div>
        <h2 className="text-lg font-semibold text-zinc-900">
          Cohorts ({activeCohorts.length} active)
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Tap a cohort to see who is allocated and whether onboarding setup is complete.
        </p>
        {activeCohorts.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            No active cohorts yet. Create one in Staff &amp; tutors.
          </p>
        ) : (
          <div className={`mt-4 ${ui.stack}`}>
            {activeCohorts.map((cohort) => (
              <CohortCard key={cohort.id} cohort={cohort} />
            ))}
          </div>
        )}
      </div>

      {pastCohorts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Past / inactive cohorts</h2>
          <div className={`mt-4 ${ui.stack}`}>
            {pastCohorts.map((cohort) => (
              <CohortCard key={cohort.id} cohort={cohort} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
