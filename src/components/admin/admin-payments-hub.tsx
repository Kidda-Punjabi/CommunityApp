"use client";

import { fetchPaymentsHubStats } from "@/app/admin/hub-stats-actions";
import {
  AdminHubLinkCard,
  AdminHubPage,
  AdminHubStack,
} from "@/components/admin/admin-hub-list";
import { ClipboardList, CreditCard, Phone, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

export function AdminPaymentsHub() {
  const [overdueCount, setOverdueCount] = useState<number | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPaymentsHubStats().then((result) => {
      if (cancelled) return;
      setOverdueCount(result.overdueCount);
      setStatsError(result.error ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onboardingSummary =
    overdueCount == null
      ? "Loading overdue count…"
      : `${overdueCount} overdue`;

  return (
    <AdminHubPage
      title="Payments"
      description="Checkout, sales calls, and onboarding queues."
    >
      {statsError ? (
        <p className="mb-6 rounded-[12px] border-[0.5px] border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {statsError}
        </p>
      ) : null}

      <AdminHubStack>
        <AdminHubLinkCard
          href="/admin/content/people/payments"
          icon={<CreditCard className="h-[18px] w-[18px]" />}
          title="Stripe checkout payments"
          summary="Checkout sessions and payment records"
        />
        <AdminHubLinkCard
          href="/admin/sales-calls"
          icon={<Phone className="h-[18px] w-[18px]" />}
          title="Sales calls"
          summary="Call log synced with Notion"
        />
        <AdminHubLinkCard
          href="/admin/onboarding"
          icon={<ClipboardList className="h-[18px] w-[18px]" />}
          title="Package onboarding"
          summary={onboardingSummary}
          count={overdueCount}
          tone={overdueCount && overdueCount > 0 ? "warning" : "neutral"}
        />
        <AdminHubLinkCard
          href="/admin/app-onboarding"
          icon={<Smartphone className="h-[18px] w-[18px]" />}
          title="App onboarding"
          summary="New member app setup"
        />
      </AdminHubStack>
    </AdminHubPage>
  );
}
