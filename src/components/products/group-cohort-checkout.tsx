"use client";

import { BuyButton } from "@/components/products/buy-button";
import { ui } from "@/lib/ui/styles";
import { useEffect, useState } from "react";

type CohortOption = {
  id: string;
  name: string;
  startDate: string | null;
  startDayOfWeek: string | null;
  sessionTimeLabel?: string;
  remainingSpots: number;
  tutorAssigned: boolean;
};

type GroupCohortCheckoutProps = {
  checkoutKey: string;
  configured: boolean;
  label?: string;
  className?: string;
};

function formatDayOfWeek(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatStartDate(value: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

export function GroupCohortCheckout({
  checkoutKey,
  configured,
  label = "Buy Now",
  className,
}: GroupCohortCheckoutProps) {
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>("");
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingCohorts(true);
    setLoadError(null);

    void fetch(`/api/stripe/group-cohorts?checkoutKey=${encodeURIComponent(checkoutKey)}`)
      .then(async (res) => {
        const data = (await res.json()) as {
          cohorts?: CohortOption[];
          checkingAvailability?: Array<{ id: string; name: string }>;
          syncWarning?: string | null;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Could not load cohorts.");
        if (!cancelled) {
          setCohorts(data.cohorts ?? []);
          setCheckingAvailability(data.checkingAvailability ?? []);
          if (data.syncWarning && (data.cohorts ?? []).length === 0) {
            setLoadError(data.syncWarning);
          }
          if ((data.cohorts ?? []).length === 1) {
            setSelectedCohortId(data.cohorts![0].id);
          }
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Could not load cohorts.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCohorts(false);
      });

    return () => {
      cancelled = true;
    };
  }, [checkoutKey]);

  async function startCheckout() {
    if (!configured) return;
    if (!selectedCohortId) {
      setCheckoutError("Choose a cohort to continue.");
      return;
    }

    setCheckingOut(true);
    setCheckoutError(null);

    try {
      const holdRes = await fetch("/api/stripe/cohort-hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohortId: selectedCohortId }),
      });
      const holdData = (await holdRes.json()) as { holdId?: string; error?: string };
      if (!holdRes.ok || !holdData.holdId) {
        throw new Error(holdData.error ?? "Could not reserve a seat.");
      }

      const checkoutRes = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutKey,
          cohortId: selectedCohortId,
          cohortSeatHoldId: holdData.holdId,
        }),
      });

      const checkoutData = (await checkoutRes.json()) as { url?: string; error?: string };
      if (!checkoutRes.ok || !checkoutData.url) {
        throw new Error(checkoutData.error ?? "Could not start checkout.");
      }

      window.location.href = checkoutData.url;
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : "Checkout failed.");
      setCheckingOut(false);
    }
  }

  if (!configured) {
    return (
      <BuyButton checkoutKey={checkoutKey} configured={false} label={label} className={className} />
    );
  }

  return (
    <div className="w-full">
      <div className={`${ui.cardBordered} mb-4 text-left`}>
        <p className="text-sm font-semibold text-zinc-900">Choose your cohort</p>
        <p className="mt-1 text-xs text-zinc-500">
          Pick an open group before checkout. Your seat is held for 20 minutes while you pay.
        </p>

        {loadingCohorts ? (
          <p className="mt-4 text-sm text-zinc-500">Loading open cohorts…</p>
        ) : loadError ? (
          <p className="mt-4 text-sm text-amber-800">{loadError}</p>
        ) : cohorts.length === 0 ? (
          <p className="mt-4 text-sm text-amber-800">
            {checkingAvailability.length > 0
              ? "Checking availability for open cohorts… refresh in a moment or try again."
              : "No cohorts are recruiting right now. Contact support or check back soon."}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {cohorts.map((cohort) => {
              const selected = selectedCohortId === cohort.id;
              const day = formatDayOfWeek(cohort.startDayOfWeek);
              const start = formatStartDate(cohort.startDate);
              return (
                <li key={cohort.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedCohortId(cohort.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                      selected
                        ? "border-violet-400 bg-violet-50"
                        : "border-zinc-200 bg-white hover:border-violet-200"
                    }`}
                  >
                    <p className="text-sm font-semibold text-zinc-900">{cohort.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-600">
                      {[day, start, cohort.sessionTimeLabel ?? "Time to be confirmed"]
                        .filter(Boolean)
                        .join(" · ")}
                      {" · "}
                      {cohort.remainingSpots} spot{cohort.remainingSpots === 1 ? "" : "s"} left
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={startCheckout}
        disabled={checkingOut || loadingCohorts || cohorts.length === 0}
        className={
          className ??
          "inline-flex w-full items-center justify-center rounded-full bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_4px_14px_-4px_rgba(124,58,237,0.5)] transition-colors hover:bg-violet-500 disabled:opacity-60"
        }
      >
        {checkingOut ? "Redirecting…" : label}
      </button>

      {checkoutError ? (
        <p className="mt-2 text-center text-sm text-red-600">{checkoutError}</p>
      ) : null}
    </div>
  );
}
