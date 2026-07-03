"use server";

import { fetchAdminOnboardingQueue } from "@/app/admin/onboarding/actions";
import { fetchAdminTutorOverview } from "@/app/admin/content/tutor-overview-actions";
import type { AdminOnboardingRow } from "@/lib/admin/onboarding/types";

export type AdminAttentionItem = {
  id: string;
  kind: "overdue_onboarding" | "tutor_calendar_disconnected";
  title: string;
  detail: string;
  href: string;
  urgent: boolean;
};

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function overdueOnboardingDetail(row: AdminOnboardingRow): string {
  const paymentIso = row.paymentDate ?? row.purchasedAt.slice(0, 10);
  const paymentLabel = formatShortDate(paymentIso);

  if (!row.packageRunId) {
    return `Payment ${paymentLabel}, still unassigned`;
  }

  if (row.progressDone < row.progressTotal) {
    return `Payment ${paymentLabel}, setup incomplete`;
  }

  return `Payment ${paymentLabel}, onboarding stalled`;
}

export async function fetchAdminHomeAttention(): Promise<{
  items: AdminAttentionItem[];
  error?: string;
}> {
  const [onboarding, tutorOverview] = await Promise.all([
    fetchAdminOnboardingQueue(),
    fetchAdminTutorOverview(),
  ]);

  const errors = [onboarding.error, tutorOverview.error].filter(Boolean);
  const items: AdminAttentionItem[] = [];

  for (const row of onboarding.rows) {
    if (!row.isOverdue) continue;
    items.push({
      id: `overdue-${row.studentPackageId}`,
      kind: "overdue_onboarding",
      title: row.studentLabel,
      detail: overdueOnboardingDetail(row),
      href: `/admin/onboarding#onboarding-row-${row.studentPackageId}`,
      urgent: true,
    });
  }

  for (const tutor of tutorOverview.tutors) {
    if (tutor.connected) continue;
    items.push({
      id: `calendar-${tutor.tutorId}`,
      kind: "tutor_calendar_disconnected",
      title: tutor.displayName,
      detail: "Calendar not connected",
      href: "/admin/content/tutors",
      urgent: false,
    });
  }

  return {
    items,
    error: errors.length > 0 ? errors.join(" · ") : undefined,
  };
}
