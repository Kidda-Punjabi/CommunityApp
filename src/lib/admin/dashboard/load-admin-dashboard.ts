import "server-only";

import {
  COHORT_SESSION_INTEGRITY_HREF,
  COHORTS_SETUP_HREF,
  cohortIssueBreakdown,
  distinctCohortCount,
  integrityIssues,
  INTEGRITY_ISSUE_BREAKDOWN,
  setupIssues,
  SETUP_ISSUE_BREAKDOWN,
  type CohortOpsIssue,
} from "@/lib/admin/dashboard/cohort-ops-issues";
import { loadCohortOpsIssues } from "@/lib/admin/dashboard/load-cohort-ops-issues";
import type {
  AdminDashboardCard,
  AdminDashboardSnapshot,
  DashboardTone,
} from "@/lib/admin/dashboard/types";
import { loadEnrollmentGaps } from "@/lib/admin/load-enrollment-gaps";
import { loadIncompletePackageChecklists } from "@/lib/admin/load-incomplete-package-checklists";
import { countPendingCohortChangeRequests } from "@/lib/admin/load-admin-cohort-change-requests";
import { loadPendingCohortSwitchRequestCreatedAts } from "@/lib/admin/load-admin-cohort-switch-requests";
import { loadOpenIssueReportCreatedAts } from "@/lib/admin/load-admin-issue-reports";
import { loadAdminOnboardingQueue } from "@/lib/admin/load-admin-onboarding";
import { loadPendingRescheduleRequestCreatedAts } from "@/lib/admin/load-admin-reschedule-requests";
import { loadUnseenAppOnboarding } from "@/lib/admin/load-unseen-app-onboarding";
import type { SupabaseClient } from "@supabase/supabase-js";

const PENDING_STALE_MS = 48 * 60 * 60 * 1000;
const ONBOARDING_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const RECORDING_LOOKBACK_DAYS = 14;
const SETUP_RED_DAYS = 7;

function pendingTone(createdAts: string[]): DashboardTone {
  if (createdAts.length === 0) return "ok";
  const cutoff = Date.now() - PENDING_STALE_MS;
  if (createdAts.some((value) => new Date(value).getTime() <= cutoff)) return "urgent";
  return "warning";
}

function ageTone(timestamps: string[], staleMs: number, nowMs: number): DashboardTone {
  if (timestamps.length === 0) return "ok";
  if (timestamps.some((value) => nowMs - new Date(value).getTime() >= staleMs)) return "urgent";
  return "warning";
}

function countTone(count: number, yellowMax: number): DashboardTone {
  if (count <= 0) return "ok";
  if (count <= yellowMax) return "warning";
  return "urgent";
}

function daysUntil(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return null;
  return (start - nowMs) / (24 * 60 * 60 * 1000);
}

function cohortOpsCards(
  issues: CohortOpsIssue[],
  error: string | undefined,
  nowMs: number
): {
  setup: { card: AdminDashboardCard; error?: string };
  integrity: { card: AdminDashboardCard; error?: string };
} {
  const setup = setupIssues(issues);
  const integrity = integrityIssues(issues);
  const setupCount = distinctCohortCount(setup);
  const integrityCount = distinctCohortCount(integrity);
  const setupBreakdown = cohortIssueBreakdown(setup, SETUP_ISSUE_BREAKDOWN);
  const integrityBreakdown = cohortIssueBreakdown(integrity, INTEGRITY_ISSUE_BREAKDOWN);

  let urgent = false;
  const seen = new Set<string>();
  for (const issue of setup) {
    if (seen.has(issue.cohortId)) continue;
    seen.add(issue.cohortId);
    const days = daysUntil(issue.startDate, nowMs);
    if (days == null || days <= SETUP_RED_DAYS) urgent = true;
  }

  return {
    setup: {
      card: {
        id: "cohorts_setup",
        label: "Cohorts needing setup",
        hint: setupCount === 0 ? "All cohorts are set up correctly." : setupBreakdown,
        href: COHORTS_SETUP_HREF,
        count: setupCount,
        tone: setupCount === 0 ? "ok" : urgent ? "urgent" : "warning",
        group: "cohorts",
        detail: setupCount === 0 ? undefined : setupBreakdown,
      },
      error,
    },
    integrity: {
      card: {
        id: "session_integrity",
        label: "Cohort session integrity",
        hint: integrityCount === 0 ? "All cohorts are set up correctly." : integrityBreakdown,
        href: COHORT_SESSION_INTEGRITY_HREF,
        count: integrityCount,
        tone: integrityCount === 0 ? "ok" : "urgent",
        group: "cohorts",
        detail: integrityCount === 0 ? undefined : integrityBreakdown,
      },
      error,
    },
  };
}

async function loadEnrollmentGapsCard(
  supabase: SupabaseClient
): Promise<{ card: AdminDashboardCard; error?: string }> {
  const result = await loadEnrollmentGaps(supabase);
  if (result.error) {
    return {
      card: {
        id: "enrollment_gaps",
        label: "Enrollment gaps",
        hint: "Could not load",
        href: "/admin/enrollment-gaps",
        count: 0,
        tone: "ok",
        group: "enrollment",
      },
      error: result.error,
    };
  }

  const count = result.grantQueue.length + result.missingAccess.length;
  return {
    card: {
      id: "enrollment_gaps",
      label: "Enrollment gaps",
      hint: "Unresolved grant queue and package instances with no student package",
      href: "/admin/enrollment-gaps",
      count,
      tone: countTone(count, 2),
      group: "enrollment",
    },
  };
}

async function loadUnresolvedEnrollmentsCard(
  supabase: SupabaseClient
): Promise<{ card: AdminDashboardCard; error?: string }> {
  const empty: AdminDashboardCard = {
    id: "unresolved_enrollments",
    label: "Unresolved enrollments",
    hint: "Could not load",
    href: "/admin/unresolved-enrollments",
    count: 0,
    tone: "ok",
    group: "enrollment",
  };
  const { data, error } = await supabase.rpc("admin_unresolved_enrollment_count");
  if (error) return { card: empty, error: error.message };
  const count = typeof data === "number" ? data : 0;
  return {
    card: {
      ...empty,
      hint: "Confirmed leads and app enrollments that do not match",
      count,
      tone: countTone(count, 3),
    },
  };
}

async function loadMissingRecordingsCard(
  supabase: SupabaseClient
): Promise<{ card: AdminDashboardCard; error?: string }> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - RECORDING_LOOKBACK_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("cohort_lesson_log_entries")
    .select("id, lesson_date, status, recording_url, package_instance_id")
    .not("package_instance_id", "is", null)
    .eq("status", "Completed")
    .gte("lesson_date", cutoffStr);

  if (error) {
    return {
      card: {
        id: "missing_recordings",
        label: "Missing 1-1 recordings",
        hint: "Could not load",
        href: "/admin/lesson-log",
        count: 0,
        tone: "ok",
        group: "ops",
      },
      error: error.message,
    };
  }

  const count = (data ?? []).filter((row) => !String(row.recording_url ?? "").trim()).length;
  return {
    card: {
      id: "missing_recordings",
      label: "Missing 1-1 recordings",
      hint: "Completed 1-1 logs in the last 14 days with no recording link",
      href: "/admin/lesson-log",
      count,
      tone: countTone(count, 5),
      group: "ops",
    },
  };
}

export async function loadAdminDashboard(
  supabase: SupabaseClient
): Promise<AdminDashboardSnapshot> {
  const nowMs = Date.now();

  const [
    cohortOps,
    switchAges,
    rescheduleAges,
    cohortChangePending,
    issueAges,
    enrollmentGaps,
    unresolved,
    onboarding,
    unseenAppOnboarding,
    incompleteChecklists,
    recordings,
  ] = await Promise.all([
    loadCohortOpsIssues(supabase),
    loadPendingCohortSwitchRequestCreatedAts(supabase),
    loadPendingRescheduleRequestCreatedAts(supabase),
    countPendingCohortChangeRequests(supabase),
    loadOpenIssueReportCreatedAts(supabase),
    loadEnrollmentGapsCard(supabase),
    loadUnresolvedEnrollmentsCard(supabase),
    loadAdminOnboardingQueue(supabase),
    loadUnseenAppOnboarding(supabase),
    loadIncompletePackageChecklists(supabase),
    loadMissingRecordingsCard(supabase),
  ]);

  const { setup, integrity } = cohortOpsCards(cohortOps.issues, cohortOps.error, nowMs);

  const paymentSetupCount = onboarding.rows.filter((row) => {
    if (!row.isOverdue) return false;
    return !row.packageRunId || row.progressDone < row.progressTotal;
  }).length;

  const cards: AdminDashboardCard[] = [
    setup.card,
    {
      id: "cohort_switch",
      label: "Group session reschedules",
      hint: "Pending group session reschedule requests",
      href: "/admin/cohort-switch-requests",
      count: switchAges.createdAts.length,
      tone: pendingTone(switchAges.createdAts),
      group: "requests",
    },
    {
      id: "reschedule",
      label: "One-to-one session reschedules",
      hint: "Pending one-to-one reschedule requests",
      href: "/admin/reschedule-requests",
      count: rescheduleAges.createdAts.length,
      tone: pendingTone(rescheduleAges.createdAts),
      group: "requests",
    },
    {
      id: "cohort_change",
      label: "Cohort switch requests",
      hint: "Pending course/level change requests",
      href: "/admin/cohort-change-requests",
      count: cohortChangePending.count,
      tone: cohortChangePending.count > 0 ? "urgent" : "ok",
      group: "requests",
    },
    {
      id: "issue_reports",
      label: "Issues",
      hint: "Open issue reports from Profile",
      href: "/admin/issue-reports",
      count: issueAges.createdAts.length,
      tone: pendingTone(issueAges.createdAts),
      group: "requests",
    },
    enrollmentGaps.card,
    unresolved.card,
    {
      id: "app_onboarding",
      label: "App onboarding incomplete",
      hint: "Students who have not seen in-app onboarding",
      href: "/admin/app-onboarding/unseen",
      count: unseenAppOnboarding.rows.length,
      tone: ageTone(
        unseenAppOnboarding.rows.map((row) => row.signedUpAt),
        ONBOARDING_STALE_MS,
        nowMs
      ),
      group: "enrollment",
    },
    {
      id: "package_onboarding",
      label: "Package onboarding incomplete",
      hint: "Checklists not marked complete — open for per-item flags",
      href: "/admin/onboarding/incomplete",
      count: incompleteChecklists.rows.length,
      tone: ageTone(
        incompleteChecklists.rows.map((row) => row.createdAt),
        ONBOARDING_STALE_MS,
        nowMs
      ),
      group: "enrollment",
    },
    {
      id: "payment_setup",
      label: "Payment setup",
      hint: "Overdue onboarding checklist / unassigned package",
      href: "/admin/onboarding",
      count: paymentSetupCount,
      tone: countTone(paymentSetupCount, 10),
      group: "enrollment",
    },
    recordings.card,
    integrity.card,
  ];

  const errors = [
    setup.error,
    switchAges.error,
    rescheduleAges.error,
    cohortChangePending.error,
    issueAges.error,
    enrollmentGaps.error,
    unresolved.error,
    onboarding.error,
    unseenAppOnboarding.error,
    incompleteChecklists.error,
    recordings.error,
  ].filter(Boolean);

  return {
    cards,
    error: errors.length > 0 ? errors.join(" · ") : undefined,
  };
}
