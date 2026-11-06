"use client";

import { useNativeApp } from "@/lib/native/native-app-context";
import { NotSoldInApp } from "@/components/native/not-sold-in-app";
import { membershipPaymentLinkUrl } from "@/lib/products/premium-checkout";
import { ui } from "@/lib/ui/styles";

type PremiumCheckoutPanelProps = {
  isPremium: boolean;
  userId: string;
  email?: string | null;
};

/** One plan only: Community with Premium included. £75 for the first 3 months, then £25 a month. */
function PremiumCheckoutPanelInApp({ isPremium, userId, email }: PremiumCheckoutPanelProps) {
  if (isPremium) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
        You&apos;re on Premium — Topics, games, Photo Translate, Live Translate, and Kids
        bedtime stories are unlocked at the full allowance.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border-2 border-violet-500 bg-violet-50/60 px-5 py-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
          Premium + Community
        </p>
        <p className="mt-1 font-heading text-3xl font-bold text-zinc-900">£75</p>
        <p className="mt-1 text-sm font-medium text-zinc-700">for your first 3 months</p>
        <p className="mt-1 text-sm text-zinc-600">then £25 a month. Cancel any time.</p>
      </div>

      <ul className="space-y-2 text-sm text-zinc-700">
        <li>Everything in Premium, unlocked in the app</li>
        <li>A live practice session every week with real Punjabi speakers</li>
        <li>A pod of learners at your level</li>
      </ul>

      <a href={membershipPaymentLinkUrl(userId, email)} className={ui.btnPrimaryBlock}>
        Join Premium
      </a>
      <p className="text-center text-xs text-zinc-500">Secure checkout with Stripe.</p>
    </div>
  );
}

/** In the iOS and Android apps, purchases are not offered (App Store guideline 3.1.1). */
export function PremiumCheckoutPanel(props: PremiumCheckoutPanelProps) {
  const native = useNativeApp();
  return native && !props.isPremium ? <NotSoldInApp /> : <PremiumCheckoutPanelInApp {...props} />;
}
