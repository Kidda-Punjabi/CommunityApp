"use client";

import { EmbeddedCheckoutBlock } from "@/components/products/embedded-checkout-block";
import { checkoutKeyRequiresCohortSelection } from "@/lib/group-purchase/client-keys";
import { isEmbeddedCheckoutConfigured } from "@/lib/products/checkout";
import { ui } from "@/lib/ui/styles";
import { useEffect, useState } from "react";

type CheckoutOption = {
  key: string;
  label: string;
};

type CohortOption = {
  id: string;
  name: string;
  startDate: string | null;
  startDayOfWeek: string | null;
  sessionTimeLabel?: string;
  remainingSpots: number;
};

function GroupEmbeddedCheckout({
  checkoutKey,
  className,
}: {
  checkoutKey: string;
  className?: string;
}) {
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [holdId, setHoldId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/stripe/group-cohorts?checkoutKey=${encodeURIComponent(checkoutKey)}`)
      .then(async (res) => {
        const data = (await res.json()) as {
          cohorts?: CohortOption[];
          checkingAvailability?: Array<{ id: string; name: string }>;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Could not load cohorts.");
        if (!cancelled) setCohorts(data.cohorts ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load cohorts.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [checkoutKey]);

  async function reserveAndCheckout(cohortId: string) {
    setError(null);
    setHoldId(null);
    const holdRes = await fetch("/api/stripe/cohort-hold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cohortId }),
    });
    const holdData = (await holdRes.json()) as { holdId?: string; error?: string };
    if (!holdRes.ok || !holdData.holdId) {
      throw new Error(holdData.error ?? "Could not reserve a seat.");
    }
    setSelectedCohortId(cohortId);
    setHoldId(holdData.holdId);
  }

  if (loading) {
    return <p className="mt-5 text-sm text-zinc-500">Loading cohorts…</p>;
  }

  if (!holdId) {
    return (
      <div className={`${ui.cardBordered} mt-5`}>
        <p className="text-sm font-semibold text-zinc-900">Choose your cohort</p>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        {cohorts.length === 0 ? (
          <p className="mt-2 text-sm text-amber-800">No recruiting cohorts available.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {cohorts.map((cohort) => (
              <li key={cohort.id}>
                <button
                  type="button"
                  onClick={() => void reserveAndCheckout(cohort.id).catch((e) => setError(e.message))}
                  className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-left text-sm hover:border-violet-200"
                >
                  <span className="font-semibold text-zinc-900">{cohort.name}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {cohort.sessionTimeLabel ?? "Time to be confirmed"}
                    {" · "}
                    {cohort.remainingSpots} spots left
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <EmbeddedCheckoutBlock
      checkoutKey={checkoutKey}
      cohortId={selectedCohortId}
      cohortSeatHoldId={holdId}
      className={className}
    />
  );
}

type ProductCheckoutSectionProps = {
  options: CheckoutOption[];
  defaultKey?: string;
};

export function ProductCheckoutSection({ options, defaultKey }: ProductCheckoutSectionProps) {
  const available = options.filter((option) => isEmbeddedCheckoutConfigured(option.key));

  if (available.length === 0) {
    return null;
  }

  const initialKey = defaultKey && available.some((o) => o.key === defaultKey)
    ? defaultKey
    : available[0].key;

  return <ProductCheckoutSectionInner options={available} initialKey={initialKey} />;
}

function ProductCheckoutSectionInner({
  options,
  initialKey,
}: {
  options: CheckoutOption[];
  initialKey: string;
}) {
  const [activeKey, setActiveKey] = useState(initialKey);

  return (
    <section className="mt-8" id="checkout">
      <h3 className="text-center font-heading text-lg font-semibold text-zinc-900">
        Secure checkout
      </h3>
      <p className="mt-1 text-center text-sm text-zinc-500">
        Apple Pay, Google Pay, cards, and promo codes supported
      </p>

      {options.length > 1 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setActiveKey(option.key)}
              className={
                activeKey === option.key
                  ? "rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-violet-200"
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {checkoutKeyRequiresCohortSelection(activeKey) ? (
        <GroupEmbeddedCheckout key={activeKey} checkoutKey={activeKey} className="mt-5" />
      ) : (
        <EmbeddedCheckoutBlock key={activeKey} checkoutKey={activeKey} className="mt-5" />
      )}
    </section>
  );
}
