"use client";

import Link from "next/link";
import type { AdminDashboardCard, DashboardTone } from "@/lib/admin/dashboard/types";
import { cn } from "@/lib/ui/styles";

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

const toneDot: Record<DashboardTone, string> = {
  ok: "bg-emerald-500",
  warning: "bg-amber-400",
  urgent: "bg-red-500",
};

const toneCount: Record<DashboardTone, string> = {
  ok: "text-emerald-700",
  warning: "text-amber-700",
  urgent: "text-red-700",
};

const toneRing: Record<DashboardTone, string> = {
  ok: "border-emerald-100",
  warning: "border-amber-200",
  urgent: "border-red-200",
};

function DashboardCard({ card }: { card: AdminDashboardCard }) {
  return (
    <Link
      href={card.href}
      className={cn(
        "rounded-[12px] border-[0.5px] bg-white px-4 py-4 transition-colors hover:bg-zinc-50",
        toneRing[card.tone]
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-zinc-600">{card.label}</p>
        <span
          className={cn("h-2.5 w-2.5 shrink-0 rounded-full", toneDot[card.tone])}
          aria-label={card.tone === "ok" ? "Green" : card.tone === "warning" ? "Yellow" : "Red"}
        />
      </div>
      <p className={cn("mt-2 text-3xl font-semibold tabular-nums tracking-tight", toneCount[card.tone])}>
        {card.count}
      </p>
      <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-zinc-500">{card.hint}</p>
    </Link>
  );
}

export function AdminDashboardGrid({ cards }: { cards: AdminDashboardCard[] }) {
  return (
    <div className="space-y-6">
      {groupOrder.map((group) => {
        const groupCards = cards.filter((card) => card.group === group);
        if (groupCards.length === 0) return null;
        return (
          <section key={group}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
              {groupLabels[group]}
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {groupCards.map((card) => (
                <DashboardCard key={card.id} card={card} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
