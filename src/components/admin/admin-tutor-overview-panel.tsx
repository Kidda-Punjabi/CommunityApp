"use client";

import Link from "next/link";
import { fetchAdminTutorOverview } from "@/app/admin/content/tutor-overview-actions";
import type { AdminTutorOverviewRow } from "@/lib/admin/load-admin-tutor-overview";
import { ui } from "@/lib/ui/styles";
import { useEffect, useMemo, useState } from "react";

export function AdminTutorOverviewPanel() {
  const [tutorOverview, setTutorOverview] = useState<AdminTutorOverviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchAdminTutorOverview().then((result) => {
      if (cancelled) return;
      setTutorOverview(result.tutors);
      setError(result.error ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const overviewStats = useMemo(() => {
    const tutorsWithCapacity = tutorOverview.filter(
      (row) => row.weeklyCapacityHours !== null && row.capacityPercent !== null
    );
    const avgCapacity =
      tutorsWithCapacity.length > 0
        ? Math.round(
            tutorsWithCapacity.reduce((sum, row) => sum + (row.capacityPercent ?? 0), 0) /
              tutorsWithCapacity.length
          )
        : null;
    const nearCapacity = tutorOverview.filter((row) => (row.capacityPercent ?? 0) >= 85).length;
    const totalStudents = tutorOverview.reduce((sum, row) => sum + row.studentCount, 0);
    return { avgCapacity, nearCapacity, totalStudents };
  }, [tutorOverview]);

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading tutor metrics…</p>;
  }

  if (error) {
    return (
      <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {error}
      </p>
    );
  }

  if (tutorOverview.length === 0) {
    return <p className="text-sm text-zinc-500">No tutors found yet.</p>;
  }

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard label="Tutors (tutor role)" value={tutorOverview.length} />
        <StatCard label="Students assigned" value={overviewStats.totalStudents} />
        <StatCard label="Near capacity (85%+)" value={overviewStats.nearCapacity} />
        <StatCard
          label="Avg capacity use"
          value={overviewStats.avgCapacity ?? 0}
          suffix={overviewStats.avgCapacity !== null ? "%" : ""}
        />
      </div>

      <ul className="space-y-3">
        {tutorOverview.map((row) => (
          <li key={row.tutorId} className={ui.cardBordered}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-zinc-900">{row.displayName}</p>
                {row.email ? <p className="text-sm text-zinc-500">{row.email}</p> : null}
                <p className="mt-1 text-xs text-zinc-500">
                  {row.connected
                    ? row.lastSyncedAt
                      ? `Calendar synced ${new Date(row.lastSyncedAt).toLocaleString("en-GB")}`
                      : "Calendar connected"
                    : "Calendar not connected"}
                </p>
              </div>
              <Link href="/admin/content/calendar" className={ui.btnGhost}>
                View calendar
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <MetricTile label="Students" value={String(row.studentCount)} />
              <MetricTile label="Upcoming lessons" value={String(row.upcomingLessonCount)} />
              <MetricTile label="Pending requests" value={String(row.pendingRequestCount)} />
              <MetricTile
                label="Capacity"
                value={`${row.usedHoursThisWeek}/${row.weeklyCapacityHours ?? 0}h`}
              />
            </div>

            {row.capacityPercent !== null ? (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
                  <span>Capacity used this week</span>
                  <span>{row.capacityPercent}%</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100">
                  <div
                    className={
                      row.capacityPercent >= 90
                        ? "h-2 rounded-full bg-rose-500"
                        : row.capacityPercent >= 75
                          ? "h-2 rounded-full bg-amber-400"
                          : "h-2 rounded-full bg-emerald-500"
                    }
                    style={{ width: `${row.capacityPercent}%` }}
                  />
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}

export function formatTutorOverviewSummary(tutorCount: number, nearCapacity: number): string {
  return `${tutorCount} tutor${tutorCount === 1 ? "" : "s"} · ${nearCapacity} near capacity`;
}

function StatCard({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className={ui.statCard}>
      <p className="text-2xl font-bold text-zinc-900">
        {value}
        {suffix}
      </p>
      <p className="mt-1 text-xs font-medium text-zinc-500">{label}</p>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-0.5 font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
