import { TIER_LABELS, type MembershipTier } from "@/lib/membership/tiers";

/** Membership rows shown on Billing & purchases. Account data, not view-as. */
export const BILLING_MEMBERSHIP_STATUSES = ["active", "trialing", "past_due"] as const;

export type BillingMembershipStatus = (typeof BILLING_MEMBERSHIP_STATUSES)[number];

export type BillingMembershipRow = {
  id: string;
  status: string;
  tier_name: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

const COURSE_TIER_LABELS = new Set<string>(["foundational", "beginners", "community"]);

export function isBillingMembershipStatus(status: string): status is BillingMembershipStatus {
  return (BILLING_MEMBERSHIP_STATUSES as readonly string[]).includes(status);
}

export function billingSubscriptionName(tierName: string | null | undefined): string {
  const tier = (tierName ?? "").trim().toLowerCase();
  if (tier === "premium") return "Kidda Premium";
  if (COURSE_TIER_LABELS.has(tier)) return TIER_LABELS[tier as MembershipTier];
  if (!tier) return "Subscription";
  return tierName!.trim();
}

export function billingMembershipsForCard(rows: BillingMembershipRow[]): BillingMembershipRow[] {
  return rows.filter((row) => isBillingMembershipStatus(row.status));
}

export function customerIdsFromMemberships(
  rows: { stripe_customer_id: string | null }[]
): string[] {
  return [
    ...new Set(
      rows
        .map((row) => row.stripe_customer_id?.trim() ?? "")
        .filter((id) => id.length > 0)
    ),
  ];
}
