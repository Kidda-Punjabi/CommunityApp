import type { PaidCourseTier } from "@/lib/membership/access";

/** When STRIPE_TIER_* env is missing on a deploy, line items still map via metadata.checkout_key. */
export function tierFromCheckoutKey(checkoutKey: string): PaidCourseTier | null {
  if (checkoutKey.startsWith("foundational")) return "foundational";
  if (checkoutKey === "community") return "community";
  // Kids Beginners is not an adult Beginners purchase.
  if (checkoutKey === "beginners-kids-group") return null;
  if (
    checkoutKey === "beginners" ||
    checkoutKey === "beginners-group" ||
    checkoutKey === "beginners-one-to-one" ||
    checkoutKey.includes("beginners")
  ) {
    return "beginners";
  }
  return null;
}
