import "server-only";

import { COMMUNITY_PACKAGE_SLUG } from "@/lib/admin/community-package";
import { isUkBankHoliday } from "@/lib/admin/dashboard/uk-bank-holidays";
import type {
  AdminDashboardCard,
  AdminDashboardSnapshot,
  DashboardTone,
} from "@/lib/admin/dashboard/types";
import { loadPendingCohortSwitchRequestCreatedAts } from "@/lib/admin/load-admin-cohort-switch-requests";
import { loadAdminOnboardingQueue } from "@/lib/admin/load-admin-onboarding";
import { loadPendingRescheduleRequestCreatedAts } from "@/lib/admin/load-admin-reschedule-requests";
import { loadMonthlyRewardsAttention } from "@/lib/admin/monthly-rewards/load-monthly-rewards";
import { loadGroupPurchaseAttention } from "@/lib/group-purchase/load-group-purchase-attention";
import type { SupabaseClient } from "@supabase/supabase-js";

const PENDING_STALE_MS = 48 * 60 * 60 * 1000;
const UNRESOLVED_GRACE_MS = 48 * 60 * 60 * 1000;
const RECORDING_LOOKBACK_DAYS = 14;
const SETUP_RED_DAYS = 7;
const MONTH_END_RED_DAYS = 5;
const ACTIVE_PACKAGE_STATUSES = new Set([
  "pre_scheduling",
  "recruiting",
  "scheduled",
  "in_progress",
  "paused",
]);

function pendingTone(createdAts: string[]): DashboardTone {
  if (createdAts.length === 0) return "ok";
  const cutoff = Date.now() - PENDING_STALE_MS;
  if (createdAts.some((value) => new Date(value).getTime() <= cutoff)) return "urgent";
  return "warning";
}

function countTone(count: number, yellowMax: number): DashboardTone {
  if (count <= 0) return "ok";
  if (count <= yellowMax) return "warning";
  return "urgent";
}

function isTestCohortName(name: string | null | undefined): boolean {
  const value = (name ?? "").trim().toLowerCase();
  return value.startsWith("test") || value.startsWith("qa ") || value.includes("qa test");
}

function daysUntil(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return null;
  return (start - nowMs) / (24 * 60 * 60 * 1000);
}

function isLastFiveDaysOfMonth(now: Date): boolean {
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return now.getDate() > lastDay - MONTH_END_RED_DAYS;
}

function normalizeNotionId(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

async function listAuthEmails(supabase: SupabaseClient): Promise<Set<string>> {
  const emails = new Set<string>();
  for (let page = 1; page <= 10; page += 1) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    for (const user of users) {
      const email = user.email?.trim().toLowerCase();
      if (email) emails.add(email);
    }
    if (users.length < 1000) break;
  }
  return emails;
}

function ownCohortClassTitle(title: string, cohortName: string): boolean {
  const lower = title.trim().toLowerCase();
  if (!lower.includes(cohortName.trim().toLowerCase())) return false;
  if (lower.includes("meeting")) return false;
  return lower.includes("class") || lower.includes("cohort");
}

async function loadCohortsSetupCard(
  supabase: SupabaseClient,
  nowMs: number
): Promise<{ card: AdminDashboardCard; error?: string }> {
  const attention = await loadGroupPurchaseAttention();
  const setupItems = attention.items.filter((item) => item.kind === "group_cohort_setup");
  const cohortIds = setupItems
    .map((item) => {
      const match = item.href.match(/cohort=([0-9a-f-]+)/i);
      return match?.[1] ?? null;
    })
    .filter((id): id is string => Boolean(id));

  const { data: cohorts, error } =
    cohortIds.length > 0
      ? await supabase.from("cohorts").select("id, start_date").in("id", cohortIds)
      : { data: [] as Array<{ id: string; start_date: string | null }>, error: null };

  const startById = new Map(
    (cohorts ?? []).map((row) => [row.id as string, (row.start_date as string | null) ?? null])
  );

  let urgent = false;
  for (const id of cohortIds) {
    const days = daysUntil(startById.get(id) ?? null, nowMs);
    if (days == null || days <= SETUP_RED_DAYS) urgent = true;
  }

  const count = setupItems.length;
  return {
    card: {
      id: "cohorts_setup",
      label: "Cohorts needing setup",
      hint: count === 0 ? "Calendar sync complete" : "No calendar sync / tutor connection",
      href: "/admin/packages",
      count,
      tone: count === 0 ? "ok" : urgent ? "urgent" : "warning",
      group: "cohorts",
    },
    error: attention.error ?? error?.message,
  };
}

async function loadEnrollmentGapsCard(
  supabase: SupabaseClient
): Promise<{ card: AdminDashboardCard; error?: string }> {
  const { data: packages, error: packageError } = await supabase
    .from("student_packages")
    .select("id, user_id, course_id, packages(slug, delivery_mode)")
    .eq("status", "confirmed");

  if (packageError) {
    return {
      card: {
        id: "enrollment_gaps",
        label: "Enrollment gaps",
        hint: "Could not load",
        href: "/admin/onboarding",
        count: 0,
        tone: "ok",
        group: "enrollment",
      },
      error: packageError.message,
    };
  }

  const rows = (packages ?? []).filter((row) => {
    const pkg = Array.isArray(row.packages) ? row.packages[0] : row.packages;
    return pkg?.slug !== COMMUNITY_PACKAGE_SLUG;
  });

  const userIds = [
    ...new Set(
      rows
        .map((row) => row.user_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const courseIds = [
    ...new Set(
      rows
        .map((row) => row.course_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  async function fetchKeyed(
    table: "course_enrollments" | "course_access"
  ): Promise<{ keys: Set<string>; error?: string }> {
    const keys = new Set<string>();
    if (userIds.length === 0 || courseIds.length === 0) return { keys };
    for (let index = 0; index < userIds.length; index += 40) {
      const chunk = userIds.slice(index, index + 40);
      const { data, error } = await supabase
        .from(table)
        .select("user_id, course_id")
        .in("user_id", chunk)
        .in("course_id", courseIds);
      if (error) return { keys, error: error.message };
      for (const row of data ?? []) {
        const typed = row as { user_id: string; course_id: string };
        keys.add(`${typed.user_id}:${typed.course_id}`);
      }
    }
    return { keys };
  }

  const [enrollResult, accessResult, memberResult] = await Promise.all([
    fetchKeyed("course_enrollments"),
    fetchKeyed("course_access"),
    (async () => {
      const memberUsers = new Set<string>();
      if (userIds.length === 0) return { memberUsers };
      for (let index = 0; index < userIds.length; index += 40) {
        const chunk = userIds.slice(index, index + 40);
        const { data, error } = await supabase
          .from("cohort_members")
          .select("user_id")
          .in("user_id", chunk)
          .is("left_at", null);
        if (error) return { memberUsers, error: error.message };
        for (const row of data ?? []) memberUsers.add(row.user_id as string);
      }
      return { memberUsers };
    })(),
  ]);

  if (enrollResult.error || accessResult.error || memberResult.error) {
    return {
      card: {
        id: "enrollment_gaps",
        label: "Enrollment gaps",
        hint: "Could not load",
        href: "/admin/onboarding",
        count: 0,
        tone: "ok",
        group: "enrollment",
      },
      error: enrollResult.error ?? accessResult.error ?? memberResult.error,
    };
  }

  const enrollKeys = enrollResult.keys;
  const accessKeys = accessResult.keys;
  const memberUsers = memberResult.memberUsers;

  let count = 0;
  for (const row of rows) {
    const pkg = Array.isArray(row.packages) ? row.packages[0] : row.packages;
    const key = `${row.user_id}:${row.course_id}`;
      const missingIdentity = !row.user_id || !row.course_id;
      const missingEnroll = missingIdentity || !enrollKeys.has(key);
      const missingAccess = missingIdentity || !accessKeys.has(key);
      const missingMember =
        pkg?.delivery_mode === "group" &&
        (!row.user_id || !memberUsers.has(row.user_id as string));
    if (missingEnroll || missingAccess || missingMember) count += 1;
  }

  return {
    card: {
      id: "enrollment_gaps",
      label: "Enrollment gaps",
      hint: "Confirmed packages missing enroll / access / cohort row",
      href: "/admin/onboarding",
      count,
      tone: countTone(count, 2),
      group: "enrollment",
    },
  };
}

async function loadUnresolvedEnrollmentsCard(
  supabase: SupabaseClient,
  nowMs: number
): Promise<{ card: AdminDashboardCard; error?: string }> {
  const [{ data: inbox, error: inboxError }, emails] = await Promise.all([
    supabase
      .from("notion_sync_inbox")
      .select("package_name, status, start_date, raw_properties"),
    listAuthEmails(supabase),
  ]);

  if (inboxError) {
    return {
      card: {
        id: "unresolved_enrollments",
        label: "Unresolved enrollments",
        hint: "Could not load",
        href: "/admin/packages",
        count: 0,
        tone: "ok",
        group: "enrollment",
      },
      error: inboxError.message,
    };
  }

  type InboxRow = {
    package_name: string | null;
    status: string | null;
    start_date: string | null;
    raw_properties: {
      Confirmed?: { relation?: Array<{ id?: string }> };
    } | null;
  };

  const leadIds: string[] = [];
  const candidates: Array<{ packageName: string; leadId: string; startAt: string | null }> = [];

  for (const row of (inbox ?? []) as InboxRow[]) {
    if (!ACTIVE_PACKAGE_STATUSES.has(row.status ?? "")) continue;
    if (/^community$/i.test(row.package_name ?? "")) continue;
    const startAt = row.start_date;
    if (startAt && nowMs - new Date(startAt).getTime() < UNRESOLVED_GRACE_MS) continue;
    for (const rel of row.raw_properties?.Confirmed?.relation ?? []) {
      if (!rel.id) continue;
      leadIds.push(rel.id);
      candidates.push({
        packageName: row.package_name ?? "Package",
        leadId: rel.id,
        startAt,
      });
    }
  }

  const uniqueLeadIds = [...new Set(leadIds)];
  const leads: Array<{ notion_page_id: string; name: string | null; email: string | null }> = [];
  for (let index = 0; index < uniqueLeadIds.length; index += 80) {
    const chunk = uniqueLeadIds.slice(index, index + 80);
    const { data, error } = await supabase
      .from("notion_leads_cache")
      .select("notion_page_id, name, email")
      .in("notion_page_id", chunk);
    if (error) {
      return {
        card: {
          id: "unresolved_enrollments",
          label: "Unresolved enrollments",
          hint: "Could not load leads",
          href: "/admin/packages",
          count: 0,
          tone: "ok",
          group: "enrollment",
        },
        error: error.message,
      };
    }
    leads.push(...(data ?? []));
  }

  const leadById = new Map(
    leads.map((lead) => [normalizeNotionId(lead.notion_page_id), lead] as const)
  );

  const flagged = new Set<string>();
  for (const candidate of candidates) {
    const lead = leadById.get(normalizeNotionId(candidate.leadId));
    const email = lead?.email?.trim().toLowerCase() ?? null;
    if (!email) continue;
    if (emails.has(email)) continue;
    flagged.add(`${email}|${candidate.packageName}`);
  }

  const count = flagged.size;
  return {
    card: {
      id: "unresolved_enrollments",
      label: "Unresolved enrollments",
      hint: "Confirmed Notion leads with no matching app account",
      href: "/admin/packages",
      count,
      tone: countTone(count, 3),
      group: "enrollment",
    },
  };
}

async function loadSessionIntegrityCard(
  supabase: SupabaseClient
): Promise<{ card: AdminDashboardCard; error?: string }> {
  const { data: cohorts, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, name, status")
    .in("status", ["recruiting", "pre_scheduling", "scheduled", "in_progress", "paused"]);

  if (cohortError) {
    return {
      card: {
        id: "session_integrity",
        label: "Session integrity",
        hint: "Could not load",
        href: "/admin/packages",
        count: 0,
        tone: "ok",
        group: "cohorts",
      },
      error: cohortError.message,
    };
  }

  const liveCohorts = (cohorts ?? []).filter((cohort) => !isTestCohortName(cohort.name as string));
  const cohortIds = liveCohorts.map((cohort) => cohort.id as string);
  const { data: sessions, error: sessionError } =
    cohortIds.length > 0
      ? await supabase
          .from("tutor_scheduled_sessions")
          .select("id, cohort_id, title, starts_at, status, week_number")
          .in("cohort_id", cohortIds)
          .in("status", ["scheduled", "cancelled"])
      : { data: [], error: null };

  if (sessionError) {
    return {
      card: {
        id: "session_integrity",
        label: "Session integrity",
        hint: "Could not load sessions",
        href: "/admin/packages",
        count: 0,
        tone: "ok",
        group: "cohorts",
      },
      error: sessionError.message,
    };
  }

  const sessionsByCohort = new Map<string, typeof sessions>();
  for (const session of sessions ?? []) {
    const cohortId = session.cohort_id as string;
    const list = sessionsByCohort.get(cohortId) ?? [];
    list.push(session);
    sessionsByCohort.set(cohortId, list);
  }

  let count = 0;
  for (const cohort of liveCohorts) {
    const name = cohort.name as string;
    const own = (sessionsByCohort.get(cohort.id as string) ?? []).filter((session) =>
      ownCohortClassTitle(session.title as string, name)
    );
    const scheduled = own.filter((session) => session.status === "scheduled");
    if (scheduled.some((session) => isUkBankHoliday(session.starts_at as string))) {
      count += 1;
      continue;
    }

    const weeks = scheduled
      .map((session) => session.week_number as number | null)
      .filter((week): week is number => week != null)
      .sort((a, b) => a - b);
    const seen = new Set<number>();
    let duplicate = false;
    for (const week of weeks) {
      if (seen.has(week)) duplicate = true;
      seen.add(week);
    }
    const unique = [...seen].sort((a, b) => a - b);
    let gap = unique.length > 0 && unique[0] !== 1;
    for (let index = 1; index < unique.length; index += 1) {
      if (unique[index] !== unique[index - 1] + 1) gap = true;
    }
    if (duplicate || gap) count += 1;
  }

  return {
    card: {
      id: "session_integrity",
      label: "Cohort session integrity",
      hint: "Bank-holiday classes still scheduled, or week-number gaps/duplicates",
      href: "/admin/packages",
      count,
      tone: count === 0 ? "ok" : "urgent",
      group: "cohorts",
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
  const now = new Date();
  const nowMs = now.getTime();

  const [
    setup,
    switchAges,
    rescheduleAges,
    enrollmentGaps,
    unresolved,
    onboarding,
    monthlyRewards,
    recordings,
    integrity,
  ] = await Promise.all([
    loadCohortsSetupCard(supabase, nowMs),
    loadPendingCohortSwitchRequestCreatedAts(supabase),
    loadPendingRescheduleRequestCreatedAts(supabase),
    loadEnrollmentGapsCard(supabase),
    loadUnresolvedEnrollmentsCard(supabase, nowMs),
    loadAdminOnboardingQueue(supabase),
    loadMonthlyRewardsAttention(supabase),
    loadMissingRecordingsCard(supabase),
    loadSessionIntegrityCard(supabase),
  ]);

  const paymentSetupCount = onboarding.rows.filter((row) => {
    if (!row.isOverdue) return false;
    return !row.packageRunId || row.progressDone < row.progressTotal;
  }).length;

  const rewardsPending = monthlyRewards.attention.pendingMonths.reduce(
    (sum, month) => sum + month.pendingCount,
    0
  );
  const rewardsUncalculated = monthlyRewards.attention.uncalculatedMonth ? 1 : 0;
  const rewardsCount = rewardsPending + rewardsUncalculated;
  const rewardsTone: DashboardTone =
    rewardsCount === 0 ? "ok" : isLastFiveDaysOfMonth(now) ? "urgent" : "warning";
  const rewardsHref = monthlyRewards.attention.uncalculatedMonth
    ? `/admin/monthly-rewards?month=${monthlyRewards.attention.uncalculatedMonth.monthStart.slice(0, 7)}`
    : "/admin/monthly-rewards";

  const cards: AdminDashboardCard[] = [
    setup.card,
    {
      id: "cohort_switch",
      label: "Cohort switch requests",
      hint: "Pending alternate-group requests",
      href: "/admin/cohort-switch-requests",
      count: switchAges.createdAts.length,
      tone: pendingTone(switchAges.createdAts),
      group: "requests",
    },
    {
      id: "reschedule",
      label: "Session reschedules",
      hint: "Pending 1-1 reschedule requests",
      href: "/admin/reschedule-requests",
      count: rescheduleAges.createdAts.length,
      tone: pendingTone(rescheduleAges.createdAts),
      group: "requests",
    },
    enrollmentGaps.card,
    unresolved.card,
    {
      id: "payment_setup",
      label: "Payment setup",
      hint: "Overdue onboarding checklist / unassigned package",
      href: "/admin/onboarding",
      count: paymentSetupCount,
      tone: countTone(paymentSetupCount, 10),
      group: "enrollment",
    },
    {
      id: "monthly_rewards",
      label: "Monthly rewards",
      hint:
        monthlyRewards.attention.uncalculatedMonth
          ? `Winners not calculated for ${monthlyRewards.attention.uncalculatedMonth.monthLabel}`
          : rewardsPending > 0
            ? "Gift cards still pending"
            : "Up to date",
      href: rewardsHref,
      count: rewardsCount,
      tone: rewardsTone,
      group: "ops",
    },
    recordings.card,
    integrity.card,
  ];

  const errors = [
    setup.error,
    switchAges.error,
    rescheduleAges.error,
    enrollmentGaps.error,
    unresolved.error,
    onboarding.error,
    monthlyRewards.error,
    recordings.error,
    integrity.error,
  ].filter(Boolean);

  return {
    cards,
    error: errors.length > 0 ? errors.join(" · ") : undefined,
  };
}
