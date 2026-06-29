import { ManageBillingButton } from "@/components/profile/manage-billing-button";
import {
  formatUnlockedCourseNames,
  getCourseAccessContext,
} from "@/lib/membership/unlocked";
import { productPath } from "@/lib/products/content";
import { loadUserBilling } from "@/lib/stripe/load-user-billing";
import { syncStripePurchasesForUser } from "@/lib/stripe/sync-purchases";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "Active",
    trialing: "Trial",
    past_due: "Past due",
    canceled: "Cancelled",
    unpaid: "Unpaid",
    incomplete: "Incomplete",
    paused: "Paused",
  };
  return labels[status] ?? status;
}

function statusColor(status: string): string {
  if (status === "active" || status === "trialing") return "text-green-700 bg-green-50";
  if (status === "past_due" || status === "unpaid") return "text-amber-700 bg-amber-50";
  return "text-zinc-600 bg-zinc-100";
}

export default async function ProfileBillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    try {
      await syncStripePurchasesForUser(user.id, user.email);
    } catch {
      // Best-effort sync.
    }
  }

  const access = await getCourseAccessContext(supabase, user!);
  const billing = await loadUserBilling();

  const activeSubscriptions = billing.subscriptions.filter(
    (sub) => sub.status === "active" || sub.status === "trialing"
  );

  return (
    <div className={ui.page}>
      <Link
        href="/dashboard/profile"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to profile
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">
        Billing & purchases
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        View your purchase history, active subscriptions, and manage billing.
      </p>

      {billing.error && (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {billing.error}
        </p>
      )}

      <div className={`mt-8 ${ui.stackLoose}`}>
        {/* Current access */}
        <div className={ui.card}>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Your access
          </p>
          <p className="mt-1 text-lg font-semibold text-violet-600">
            {formatUnlockedCourseNames(access.courses, access.unlockedCourseIds)}
          </p>
          <Link
            href="/dashboard/learn"
            className="mt-3 inline-block text-sm font-semibold text-violet-600 hover:text-violet-500"
          >
            Go to Learn →
          </Link>
        </div>

        {/* Subscriptions */}
        <div className={ui.card}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Subscriptions
              </p>
              {activeSubscriptions.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">No active subscriptions.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {activeSubscriptions.map((sub) => (
                    <li key={sub.id} className="rounded-2xl bg-zinc-50 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-zinc-900">{sub.productName}</p>
                          {sub.amountLabel && sub.interval && (
                            <p className="mt-0.5 text-sm text-zinc-600">
                              {sub.amountLabel}/{sub.interval}
                            </p>
                          )}
                          {sub.currentPeriodEnd && (
                            <p className="mt-1 text-xs text-zinc-500">
                              {sub.cancelAtPeriodEnd ? "Cancels" : "Renews"} on{" "}
                              {formatDate(sub.currentPeriodEnd)}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(sub.status)}`}
                        >
                          {statusLabel(sub.status)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {billing.hasStripeCustomer && activeSubscriptions.length > 0 && (
            <div className="mt-4">
              <ManageBillingButton />
              <p className="mt-2 text-xs text-zinc-500">
                Update payment method, view invoices, or cancel your subscription.
              </p>
            </div>
          )}
        </div>

        {/* Purchase history */}
        <div className={ui.card}>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Purchase history
          </p>
          {billing.purchases.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No purchases yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100">
              {billing.purchases.map((purchase) => (
                <li key={purchase.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900">
                      {purchase.products.join(", ") || "Purchase"}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">{formatDate(purchase.date)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {purchase.amountLabel && (
                      <p className="font-semibold text-zinc-900">{purchase.amountLabel}</p>
                    )}
                    <p className="text-xs capitalize text-zinc-500">{purchase.status}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Browse more */}
        <div className={ui.card}>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Browse courses
          </p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href={productPath("foundational")} className="text-sm font-medium text-violet-600">
                Foundational Course →
              </Link>
            </li>
            <li>
              <Link href={productPath("beginners")} className="text-sm font-medium text-violet-600">
                Beginners Course →
              </Link>
            </li>
            <li>
              <Link href={productPath("community")} className="text-sm font-medium text-violet-600">
                Kidda Community →
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
