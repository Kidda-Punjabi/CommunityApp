"use client";

import { AdminMetricCard } from "@/components/admin/admin-metric-card";
import type { AdminDashboardCard, DashboardCardId } from "@/lib/admin/dashboard/types";

const groupLabels: Record<AdminDashboardCard["group"], string> = {
  enrollment: "Enrollment",
  requests: "Requests",
  cohorts: "Cohorts",
  ops: "Ops",
};

const groupOrder: AdminDashboardCard["group"][] = [
  "enrollment",
  "requests",
  "cohorts",
  "ops",
];

/** Slot order matches the existing dashboard assembly so layout never reshuffles. */
const slotsByGroup: Record<AdminDashboardCard["group"], DashboardCardId[]> = {
  enrollment: [
    "enrollment_gaps",
    "unresolved_enrollments",
    "app_onboarding",
    "package_onboarding",
    "payment_setup",
  ],
  requests: ["cohort_switch", "reschedule"],
  cohorts: ["cohorts_setup", "session_integrity"],
  ops: ["monthly_rewards", "missing_recordings"],
};

export function AdminDashboardGrid({
  cards,
  loading = false,
}: {
  cards: AdminDashboardCard[];
  loading?: boolean;
}) {
  const byId = new Map(cards.map((card) => [card.id, card]));

  return (
    <div className="space-y-6" aria-busy={loading}>
      {groupOrder.map((group) => (
        <section key={group}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            {groupLabels[group]}
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {slotsByGroup[group].map((id) => {
              const card = byId.get(id);
              if (loading || !card) {
                return <AdminMetricCard key={id} label="" tone="ok" loading />;
              }
              return (
                <AdminMetricCard
                  key={id}
                  label={card.label}
                  value={card.count}
                  hint={card.hint}
                  href={card.href}
                  tone={card.tone}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
