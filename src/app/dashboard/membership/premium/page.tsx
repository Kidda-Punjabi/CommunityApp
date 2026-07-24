import { PremiumCheckoutPanel } from "@/components/membership/premium-checkout-panel";
import { BackLink } from "@/components/navigation/back-link";
import { loadPremiumAccess } from "@/lib/membership/premium-access";
import {
  isPremiumCheckoutConfigured,
  premiumPriceIds,
} from "@/lib/products/premium-checkout";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Premium | Kidda",
  description: "Unlock Topics, games, Photo Translate, and Kids bedtime stories with Kidda Premium.",
};

export default async function PremiumMembershipPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/membership/premium");

  const params = await searchParams;
  const premium = await loadPremiumAccess(supabase, user.id);
  const ids = premiumPriceIds();

  return (
    <div className={ui.page}>
      <BackLink fallbackHref="/dashboard/home" className="text-sm font-medium text-violet-600">
        ← Back
      </BackLink>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          Membership
        </p>
        <h1 className="mt-1 font-heading text-2xl font-bold text-zinc-900">Kidda Premium</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600">
          Unlock all 24 Topics weeks, the full games catalogue, 30 Photo Translate scans each
          month, and Kids Mode bedtime stories — billed quarterly or annually.
        </p>
      </div>

      {params.checkout === "success" && !premium.isPremium ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Payment received — Premium unlocks as soon as Stripe confirms your subscription.
        </p>
      ) : null}

      <div className={`mt-8 ${ui.cardBordered}`}>
        <PremiumCheckoutPanel
          isPremium={premium.isPremium}
          quarterlyConfigured={Boolean(ids.quarterly?.startsWith("price_"))}
          annualConfigured={Boolean(ids.annual?.startsWith("price_"))}
        />
      </div>

      {!isPremiumCheckoutConfigured() ? (
        <p className="mt-4 text-xs text-zinc-500">
          Waiting on Stripe price IDs: STRIPE_PREMIUM_QUARTERLY_PRICE_ID,
          STRIPE_PREMIUM_ANNUAL_PRICE_ID.
        </p>
      ) : null}

      <ul className="mt-8 space-y-2 text-sm text-zinc-600">
        <li>• Topics weeks 4–24</li>
        <li>• All games beyond the free starter set</li>
        <li>• Photo Translate: 30 scans / month</li>
        <li>• Kids bedtime stories (parent Premium)</li>
      </ul>
    </div>
  );
}
