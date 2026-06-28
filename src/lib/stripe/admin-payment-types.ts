import type { PaidCourseTier } from "@/lib/membership/access";

export type AdminPaymentRow = {
  sessionId: string;
  createdAt: string;
  email: string | null;
  amountLabel: string | null;
  paymentStatus: string;
  sessionStatus: string;
  products: string[];
  tiers: PaidCourseTier[];
  appUserId: string | null;
  appUserLabel: string | null;
  stripeUrl: string;
};

const TIER_LABELS: Record<string, string> = {
  foundational: "Foundational",
  beginners: "Beginners",
  community: "Community",
};

export function formatTierLabels(tiers: PaidCourseTier[]): string {
  if (tiers.length === 0) return "Unmapped";
  return tiers.map((tier) => TIER_LABELS[tier] ?? tier).join(", ");
}
