"use client";

import Link from "next/link";
import { fetchAdminTutorOverview } from "@/app/admin/content/tutor-overview-actions";
import { useAdminData } from "@/app/admin/content/admin-data-provider";
import { AdminFetchErrors } from "@/components/admin/admin-fetch-errors";
import { ui } from "@/lib/ui/styles";
import { useEffect, useMemo, useState } from "react";

type HubLink = {
  href: string;
  title: string;
  description: string;
  stat: string;
};

export function AdminHomeContent() {
  const { data } = useAdminData();
  const [tutorOverview, setTutorOverview] = useState<
    Awaited<ReturnType<typeof fetchAdminTutorOverview>>["tutors"]
  >([]);
  const [tutorOverviewError, setTutorOverviewError] = useState<string | null>(null);
  const [loadingTutorOverview, setLoadingTutorOverview] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchAdminTutorOverview().then((result) => {
      if (cancelled) return;
      setTutorOverview(result.tutors);
      setTutorOverviewError(result.error ?? null);
      setLoadingTutorOverview(false);
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

  const links: HubLink[] = [
    {
      href: "/admin/content/help",
      title: "Help articles",
      description: "FAQs and SOPs for cohorts, members, curriculum, and payments",
      stat: "Admin guides",
    },
    {
      href: "/admin/content/people",
      title: "People",
      description: "Members, Stripe payments, tutors, and staff",
      stat: `${data.enrollments.length} enrollments`,
    },
    {
      href: "/admin/content/calendar",
      title: "Tutor calendars",
      description: "View synced lessons and remind tutors to connect Google Calendar",
      stat: `${data.staffMembers.length} staff`,
    },
    {
      href: "/admin/packages",
      title: "Packages",
      description: "Group cohorts and 1-1 runs — roster, schedule, and status",
      stat: `${data.cohorts.length} cohorts`,
    },
    {
      href: "/admin/content/curriculum",
      title: "Content",
      description: "Learn curriculum and practice games",
      stat: `${data.lessons.length} lessons`,
    },
    {
      href: "/admin/content/site",
      title: "Site & comms",
      description: "Events, announcements, branding, and debug tools",
      stat: `${data.events.length} events`,
    },
  ];

  return (
    <div className={ui.page}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Admin home</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Pick a section below — same layout as the learner and tutor apps.
        </p>
      </div>

      <AdminFetchErrors errors={data.errors} />

      <div className="mb-8 grid grid-cols-2 gap-3">
        <StatCard label="Courses" value={data.courses.length} />
        <StatCard label="Members enrolled" value={data.enrollments.length} />
        <StatCard label="Cohorts" value={data.cohorts.length} />
        <StatCard label="Staff" value={data.staffMembers.length} />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Sections
      </h2>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={`${ui.cardInteractive} flex items-center gap-4`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-zinc-900">{link.title}</p>
                <p className="mt-0.5 text-sm text-zinc-500">{link.description}</p>
                <p className="mt-1 text-xs font-medium text-violet-600">{link.stat}</p>
              </div>
              <span className="text-violet-600" aria-hidden="true">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Tutor overview
          </h2>
          <Link href="/admin/content/calendar" className="text-sm font-medium text-violet-600 hover:text-violet-500">
            Open calendar view →
          </Link>
        </div>

        {loadingTutorOverview ? (
          <p className="text-sm text-zinc-500">Loading tutor metrics…</p>
        ) : tutorOverviewError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {tutorOverviewError}
          </p>
        ) : tutorOverview.length === 0 ? (
          <p className="text-sm text-zinc-500">No tutors found yet.</p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3">
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
                      value={
                        row.weeklyCapacityHours !== null
                          ? `${row.usedHoursThisWeek}/${row.weeklyCapacityHours}h`
                          : "Not set"
                      }
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
        )}
      </section>
    </div>
  );
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
