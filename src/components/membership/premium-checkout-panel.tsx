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

const PLANS: Record<
  PremiumCheckoutKey,
  { label: string; price: string; detail: string; badge?: string }
> = {
  "premium-annual": {
    label: "Annual",
    price: "£99 / year",
    detail: "Best value",
    badge: "Best value",
  },
  "premium-quarterly": {
    label: "Quarterly",
    price: "£30 / quarter",
    detail: "Billed every 3 months",
  },
};

export function PremiumCheckoutPanel({
  isPremium,
  userId,
}: PremiumCheckoutPanelProps) {
  const [plan, setPlan] = useState<PremiumCheckoutKey>("premium-annual");

  if (isPremium) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
        You&apos;re on Premium — Topics, games, Photo Translate, Live Translate, and Kids
        bedtime stories are unlocked at the full allowance.
      </div>
    );
  }

  const selected = PLANS[plan];
  const checkoutUrl = premiumPaymentLinkUrl(plan, userId);

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Billing period"
        className="mx-auto flex w-full max-w-sm rounded-full border border-zinc-200 bg-zinc-100 p-1"
      >
        {(
          [
            ["premium-annual", "Annual"],
            ["premium-quarterly", "Quarterly"],
          ] as const
        ).map(([key, label]) => {
          const active = plan === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPlan(key)}
              className={`relative flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-white text-violet-700 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {label}
              {key === "premium-annual" ? (
                <span className="ml-1 hidden text-[10px] font-bold uppercase tracking-wide text-violet-500 sm:inline">
                  Best
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-violet-200 bg-violet-50/60 px-5 py-5 text-center">
        {selected.badge ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
            {selected.badge}
          </p>
        ) : (
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {selected.label}
          </p>
        )}
        <p className="mt-1 font-heading text-3xl font-bold text-zinc-900">
          {selected.price}
        </p>
        <p className="mt-1 text-sm text-zinc-600">{selected.detail}</p>
      </div>

      <a href={checkoutUrl} className={ui.btnPrimaryBlock}>
        Continue to Stripe
      </a>
    </div>
  );
}
