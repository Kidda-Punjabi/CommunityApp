"use client";

import { fetchCohortsHubStats } from "@/app/admin/hub-stats-actions";
import {
  AdminHubLinkCard,
  AdminHubPage,
  AdminHubStack,
} from "@/components/admin/admin-hub-list";
import {
  ArrowLeftRight,
  CalendarClock,
  CalendarDays,
  Eye,
  Layers,
  Repeat,
  UserRoundCog,
} from "lucide-react";
import { useEffect, useState } from "react";

function pendingRequestSummary(count: number | null): string {
  if (count == null) return "Loading pending requests…";
  return count === 1 ? "1 pending request" : `${count} pending requests`;
}

export function AdminCohortsHub() {
  const [pendingReschedules, setPendingReschedules] = useState<number | null>(null);
  const [pendingCohortChanges, setPendingCohortChanges] = useState<number | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchCohortsHubStats().then((result) => {
      if (cancelled) return;
      setPendingReschedules(result.pendingReschedules);
      setPendingCohortChanges(result.pendingCohortChanges);
      setStatsError(result.error ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminHubPage
      title="Cohorts"
      description="Run groups, lesson logs, reschedules, and tutor cover."
    >
      {statsError ? (
        <p className="mb-6 rounded-[12px] border-[0.5px] border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {statsError}
        </p>
      ) : null}

      <AdminHubStack>
        <AdminHubLinkCard
          href="/admin/packages"
          icon={<Layers className="h-[18px] w-[18px]" />}
          title="All cohorts"
          summary="Every live and upcoming group package"
        />
        <AdminHubLinkCard
          href="/admin/lesson-log"
          icon={<CalendarDays className="h-[18px] w-[18px]" />}
          title="Lesson log"
          summary="Attendance and session history"
        />
        <AdminHubLinkCard
          href="/admin/reschedule-requests"
          icon={<CalendarClock className="h-[18px] w-[18px]" />}
          title="One-to-one session reschedules"
          summary={pendingRequestSummary(pendingReschedules)}
          count={pendingReschedules}
          tone={pendingReschedules && pendingReschedules > 0 ? "warning" : "neutral"}
        />
        <AdminHubLinkCard
          href="/admin/cohort-switch-requests"
          icon={<ArrowLeftRight className="h-[18px] w-[18px]" />}
          title="Group session reschedules"
          summary="Approve or decline student requests to join an alternate group session"
        />
        <AdminHubLinkCard
          href="/admin/cohort-change-requests"
          icon={<Repeat className="h-[18px] w-[18px]" />}
          title="Cohort switch requests"
          summary={pendingRequestSummary(pendingCohortChanges)}
          count={pendingCohortChanges}
          tone={pendingCohortChanges && pendingCohortChanges > 0 ? "warning" : "neutral"}
        />
        <AdminHubLinkCard
          href="/admin/cover-requests"
          icon={<UserRoundCog className="h-[18px] w-[18px]" />}
          title="Tutor cover"
          summary="Cover requests for upcoming lessons"
        />
        <AdminHubLinkCard
          href="/admin/test-cohort-switch"
          icon={<Eye className="h-[18px] w-[18px]" />}
          title="Test Group Reschedule"
          summary="Preview the live student alternate-session request. Nothing is submitted."
        />
        <AdminHubLinkCard
          href="/admin/test-session-reschedule"
          icon={<Eye className="h-[18px] w-[18px]" />}
          title="Test One-to-one Reschedule"
          summary="Preview the live student 1-to-1 reschedule request. Nothing is submitted."
        />
        <AdminHubLinkCard
          href="/admin/homework-test"
          icon={<Eye className="h-[18px] w-[18px]" />}
          title="Test homework submission"
          summary="Submit live homework as a student to verify the tutor inbox and audio pipeline."
        />
      </AdminHubStack>
    </AdminHubPage>
  );
}
