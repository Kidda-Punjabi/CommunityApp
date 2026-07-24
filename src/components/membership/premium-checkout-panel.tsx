"use client";

import { useState, useTransition } from "react";
import type { PremiumCheckoutKey } from "@/lib/products/premium-checkout";
import { ui } from "@/lib/ui/styles";

type PremiumCheckoutPanelProps = {
  isPremium: boolean;
  quarterlyConfigured: boolean;
  annualConfigured: boolean;
};

export function PremiumCheckoutPanel({
  isPremium,
  quarterlyConfigured,
  annualConfigured,
}: PremiumCheckoutPanelProps) {
  const [plan, setPlan] = useState<PremiumCheckoutKey>(
    annualConfigured ? "premium-annual" : "premium-quarterly"
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (isPremium) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
        You&apos;re on Premium — Topics, games, Photo Translate, and Kids bedtime stories are
        unlocked.
      </div>
    );
  }

  const anyConfigured = quarterlyConfigured || annualConfigured;
  const configured =
    plan === "premium-quarterly" ? quarterlyConfigured : annualConfigured;

  function startCheckout() {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkoutKey: plan }),
        });
        const data = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !data.url) {
          setError(data.error ?? "Checkout could not start.");
          return;
        }
        window.location.href = data.url;
      } catch {
        setError("Checkout could not start.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setPlan("premium-quarterly")}
          disabled={!quarterlyConfigured}
          className={`rounded-2xl border px-4 py-4 text-left transition ${
            plan === "premium-quarterly"
              ? "border-violet-500 bg-violet-50"
              : "border-zinc-200 bg-white"
          } ${!quarterlyConfigured ? "opacity-50" : ""}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
            Quarterly
          </p>
          <p className="mt-1 font-heading text-lg font-semibold text-zinc-900">£30 / quarter</p>
          <p className="mt-1 text-xs text-zinc-500">Billed every 3 months</p>
        </button>
        <button
          type="button"
          onClick={() => setPlan("premium-annual")}
          disabled={!annualConfigured}
          className={`rounded-2xl border px-4 py-4 text-left transition ${
            plan === "premium-annual"
              ? "border-violet-500 bg-violet-50"
              : "border-zinc-200 bg-white"
          } ${!annualConfigured ? "opacity-50" : ""}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Annual</p>
          <p className="mt-1 font-heading text-lg font-semibold text-zinc-900">£99 / year</p>
          <p className="mt-1 text-xs text-zinc-500">Best value</p>
        </button>
      </div>

      {!anyConfigured ? (
        <p className="text-sm text-amber-800">
          Premium checkout is not configured yet. Add Stripe price IDs in the environment.
        </p>
      ) : null}

      <button
        type="button"
        onClick={startCheckout}
        disabled={pending || !configured}
        className={ui.btnPrimaryBlock}
      >
        {pending ? "Starting checkout…" : "Continue to Stripe"}
      </button>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
