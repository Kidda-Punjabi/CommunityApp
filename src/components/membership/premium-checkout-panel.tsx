"use client";

import { useState } from "react";
import {
  premiumPaymentLinkUrl,
  type PremiumCheckoutKey,
} from "@/lib/products/premium-checkout";
import { ui } from "@/lib/ui/styles";

type PremiumCheckoutPanelProps = {
  isPremium: boolean;
  userId: string;
};

export function PremiumCheckoutPanel({
  isPremium,
  userId,
}: PremiumCheckoutPanelProps) {
  const [plan, setPlan] = useState<PremiumCheckoutKey>("premium-annual");

  if (isPremium) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
        You&apos;re on Premium — Topics, games, Photo Translate, and Kids bedtime stories are
        unlocked.
      </div>
    );
  }

  const checkoutUrl = premiumPaymentLinkUrl(plan, userId);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setPlan("premium-quarterly")}
          className={`rounded-2xl border px-4 py-4 text-left transition ${
            plan === "premium-quarterly"
              ? "border-violet-500 bg-violet-50"
              : "border-zinc-200 bg-white"
          }`}
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
          className={`rounded-2xl border px-4 py-4 text-left transition ${
            plan === "premium-annual"
              ? "border-violet-500 bg-violet-50"
              : "border-zinc-200 bg-white"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Annual</p>
          <p className="mt-1 font-heading text-lg font-semibold text-zinc-900">£99 / year</p>
          <p className="mt-1 text-xs text-zinc-500">Best value</p>
        </button>
      </div>

      <a href={checkoutUrl} className={ui.btnPrimaryBlock}>
        Continue to Stripe
      </a>
    </div>
  );
}
