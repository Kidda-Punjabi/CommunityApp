import type {
  CashDiscrepancyRow,
  CountMetric,
  MetricAvailability,
  MoneyMetric,
  RateMetric,
} from "@/lib/admin/acquisition/types";

export function countMetric(
  value: number | null,
  previous: number | null,
  options?: { unavailableReason?: string }
): CountMetric {
  if (options?.unavailableReason) {
    return {
      availability: "unavailable",
      value: null,
      previous: null,
      reason: options.unavailableReason,
    };
  }
  if (value == null) {
    return { availability: "unavailable", value: null, previous: null, reason: "No data" };
  }
  if (value === 0) {
    return { availability: "empty", value: 0, previous, reason: "No records in this period" };
  }
  return { availability: "ok", value, previous };
}

export function rateMetric(
  numerator: number | null,
  denominator: number | null,
  previousNumerator: number | null,
  previousDenominator: number | null,
  emptyDenominatorReason: string
): RateMetric {
  if (numerator == null || denominator == null) {
    return {
      availability: "unavailable",
      value: null,
      previous: null,
      numerator,
      denominator,
      reason: "No data",
    };
  }
  if (denominator <= 0) {
    return {
      availability: "unavailable",
      value: null,
      previous: null,
      numerator,
      denominator,
      reason: emptyDenominatorReason,
    };
  }
  const value = numerator / denominator;
  const previous =
    previousNumerator != null && previousDenominator != null && previousDenominator > 0
      ? previousNumerator / previousDenominator
      : null;
  return { availability: "ok", value, previous, numerator, denominator };
}

export function moneyMetric(
  pounds: number | null,
  previous: number | null,
  options?: { unavailableReason?: string; emptyReason?: string }
): MoneyMetric {
  if (options?.unavailableReason) {
    return {
      availability: "unavailable",
      value: null,
      previous: null,
      reason: options.unavailableReason,
    };
  }
  if (pounds == null) {
    return { availability: "unavailable", value: null, previous: null, reason: "No data" };
  }
  if (pounds === 0) {
    return {
      availability: "empty",
      value: 0,
      previous,
      reason: options?.emptyReason ?? "No cash in this period",
    };
  }
  return { availability: "ok", value: pounds, previous };
}

export function availabilityOf(metric: { availability: MetricAvailability }): MetricAvailability {
  return metric.availability;
}

export function isUnworkedPipelineStage(name: string | null | undefined): boolean {
  const value = (name ?? "").trim().toLowerCase();
  if (!value) return false;
  if (value === "new lead" || value === "intake") return true;
  return value.startsWith("need to message");
}

export function salesVelocityPoundsPerDay(input: {
  opportunities: number | null;
  winRate: number | null;
  averageDealValuePounds: number | null;
  cycleDays: number | null;
}): number | null {
  const { opportunities, winRate, averageDealValuePounds, cycleDays } = input;
  if (
    opportunities == null ||
    winRate == null ||
    averageDealValuePounds == null ||
    cycleDays == null
  ) {
    return null;
  }
  if (opportunities <= 0 || cycleDays <= 0) return null;
  return (opportunities * averageDealValuePounds * winRate) / cycleDays;
}

export function averageCycleDays(durationsDays: number[]): number | null {
  const valid = durationsDays.filter((days) => Number.isFinite(days) && days > 0);
  if (valid.length === 0) return null;
  return valid.reduce((sum, days) => sum + days, 0) / valid.length;
}

export function msToDays(ms: number): number {
  return ms / (24 * 60 * 60 * 1000);
}

export type CohortFillStatus = "full" | "ontrack" | "atrisk" | "behind" | "unknown";

export function cohortFillStatus(
  filled: number | null,
  capacity: number | null,
  daysLeft: number | null
): { status: CohortFillStatus; label: string } {
  if (filled == null || capacity == null || capacity <= 0) {
    return { status: "unknown", label: "No seats data" };
  }
  const remaining = Math.max(0, capacity - filled);
  const ratio = filled / capacity;
  if (ratio >= 1) return { status: "full", label: "Full" };

  const days = daysLeft;
  if (days != null && days <= 7 && ratio < 0.85) {
    return { status: "behind", label: `${remaining} seats open` };
  }
  if (days != null && days <= 14 && ratio < 0.5) {
    return { status: "behind", label: `${remaining} seats open` };
  }
  if (ratio < 0.25) {
    return { status: "behind", label: `${remaining} seats open` };
  }
  if (ratio < 0.5 || (days != null && days <= 21 && ratio < 0.75)) {
    return { status: "atrisk", label: `${remaining} seats open` };
  }
  return { status: "ontrack", label: "On track" };
}

export function timeToFillDays(
  joinedAts: string[],
  capacity: number
): number | null {
  if (capacity <= 0) return null;
  const times = joinedAts
    .map((value) => new Date(value).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);
  if (times.length < capacity) return null;
  const first = times[0];
  const filledAt = times[capacity - 1];
  if (filledAt < first) return null;
  return msToDays(filledAt - first);
}

export function poundsToPence(pounds: number | null | undefined): number {
  if (pounds == null || !Number.isFinite(pounds)) return 0;
  return Math.round(pounds * 100);
}

export function penceToPounds(pence: number): number {
  return pence / 100;
}

export type MatchablePayment = {
  id: string;
  email: string | null;
  name: string | null;
  amountPence: number;
};

export function matchCashDiscrepancy(
  stripePayments: MatchablePayment[],
  notionPayments: MatchablePayment[],
  amountTolerancePence = 100
): CashDiscrepancyRow[] {
  const usedNotion = new Set<string>();
  const rows: CashDiscrepancyRow[] = [];

  const notionByEmail = new Map<string, MatchablePayment[]>();
  for (const payment of notionPayments) {
    const email = payment.email?.trim().toLowerCase() || "";
    const list = notionByEmail.get(email) ?? [];
    list.push(payment);
    notionByEmail.set(email, list);
  }

  for (const stripe of stripePayments) {
    const email = stripe.email?.trim().toLowerCase() || "";
    const candidates = (notionByEmail.get(email) ?? []).filter((row) => !usedNotion.has(row.id));
    if (candidates.length === 0) {
      rows.push({
        kind: "stripe_only",
        email: stripe.email,
        name: stripe.name,
        stripePence: stripe.amountPence,
        notionPence: null,
        salesCallId: null,
        note: "In Stripe, not on the sales call log",
      });
      continue;
    }
    candidates.sort(
      (a, b) =>
        Math.abs(a.amountPence - stripe.amountPence) - Math.abs(b.amountPence - stripe.amountPence)
    );
    const best = candidates[0];
    usedNotion.add(best.id);
    if (Math.abs(best.amountPence - stripe.amountPence) > amountTolerancePence) {
      rows.push({
        kind: "amount_mismatch",
        email: stripe.email ?? best.email,
        name: best.name ?? stripe.name,
        stripePence: stripe.amountPence,
        notionPence: best.amountPence,
        salesCallId: best.id,
        note: "Amounts differ — update the sales call log",
      });
    }
  }

  for (const notion of notionPayments) {
    if (usedNotion.has(notion.id)) continue;
    rows.push({
      kind: "notion_only",
      email: notion.email,
      name: notion.name,
      stripePence: null,
      notionPence: notion.amountPence,
      salesCallId: notion.id,
      note: "On the sales call log, no matching Stripe payment",
    });
  }

  return rows;
}

export function cashBucketFromCheckoutKey(
  checkoutKey: string | null | undefined
): "group" | "one_to_one" | "community" | "other" {
  const key = (checkoutKey ?? "").trim().toLowerCase();
  if (!key) return "other";
  if (key === "community" || key.startsWith("community")) return "community";
  if (key.includes("one-to-one") || key.includes("one_to_one") || key.includes("1-1")) {
    return "one_to_one";
  }
  if (key.includes("group") || key === "beginners") return "group";
  if (key.startsWith("foundational") && !key.includes("group")) return "one_to_one";
  return "other";
}

export function conversionFromPrevious(
  current: number | null,
  previous: number | null
): number | null {
  if (current == null || previous == null || previous <= 0) return null;
  return current / previous;
}

export function isTestCohortName(name: string | null | undefined): boolean {
  const value = (name ?? "").trim().toLowerCase();
  return value.startsWith("test") || value.startsWith("qa ") || value.includes("qa test");
}

export function shortCohortLabel(name: string): string {
  const match = name.match(/(\d+)/);
  if (match) return `C${match[1]}`;
  return name.slice(0, 8);
}
