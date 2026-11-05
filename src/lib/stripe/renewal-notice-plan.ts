/** Rules for the 7-day renewal notice. Pure so they can be tested without Stripe. */

export const RENEWAL_NOTICE_DAYS = 7;

export type RenewalCandidate = {
  status: string;
  cancelAtPeriodEnd: boolean;
  /** Set on instalment plans and on subscriptions already due to end. */
  cancelAt: number | null;
  paused: boolean;
  /** Unix seconds. */
  periodEnd: number | null;
};

export function shouldSendRenewalNotice(candidate: RenewalCandidate, now: Date): boolean {
  if (candidate.status !== "active" && candidate.status !== "trialing") return false;
  if (candidate.cancelAtPeriodEnd || candidate.cancelAt || candidate.paused) return false;
  if (!candidate.periodEnd) return false;
  const msUntilRenewal = candidate.periodEnd * 1000 - now.getTime();
  return msUntilRenewal > 0 && msUntilRenewal <= RENEWAL_NOTICE_DAYS * 24 * 60 * 60 * 1000;
}

export function renewalSubscriptionName(productName: string | null, isPremium: boolean): string {
  if (isPremium) return "Kidda Premium";
  return productName?.trim() || "Kidda";
}

export function renewalMessage(subscriptionName: string, periodEnd: Date): string {
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "long",
  }).format(periodEnd);
  return `Your ${subscriptionName} subscription renews on ${date}.`;
}
