import { PremiumCheckoutPanel } from "@/components/membership/premium-checkout-panel";
import { PremiumComparisonTable } from "@/components/membership/premium-comparison-table";
import { BackLink } from "@/components/navigation/back-link";
import { loadPremiumAccess } from "@/lib/membership/premium-access";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Premium | Kidda",
  description:
    "Compare Free vs Kidda Premium — unlock all Topics, games, translate allowances, and Kids bedtime stories.",
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

  return (
    <div className={ui.page}>
      <BackLink fallbackHref="/dashboard/learn" className="text-sm font-medium text-violet-600">
        ← Back
      </BackLink>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          Membership
        </p>
        <h1 className="mt-1 font-heading text-2xl font-bold text-zinc-900">Kidda Premium</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600">
          See exactly what Free includes — then upgrade for the full catalogue, higher
          translate allowances, and all Kids bedtime stories.
        </p>
      </div>

      {params.checkout === "success" && !premium.isPremium ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Payment received — Premium unlocks as soon as Stripe confirms your subscription.
        </p>
      ) : null}

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Free vs Premium
        </h2>
        <PremiumComparisonTable />
      </div>

      <div className={`mt-8 ${ui.cardBordered}`}>
        <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Choose your plan
        </h2>
        <PremiumCheckoutPanel isPremium={premium.isPremium} userId={user.id} />
      </div>

      <p className="mt-8 text-center text-sm text-zinc-500">
        Looking for tutor-led courses instead?{" "}
        <Link href="/courses" className="font-semibold text-violet-600 hover:text-violet-500">
          Browse Foundational, Beginners &amp; Community
        </Link>
      </p>
    </div>
  );
}
