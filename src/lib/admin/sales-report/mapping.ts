export const UNASSIGNED_SALESPERSON = "Unassigned";

export const LOST_OUTCOMES = [
  "Not Interested",
  "Can't Afford",
  "Cancelled",
  "Refunded",
] as const;

export const OPEN_PIPELINE_OUTCOMES = [
  "Follow Up",
  "Enrolment Call Booked",
  "Check-In Call Booked",
  "Rescheduled",
] as const;

export function isPaidInFull(
  outstandingBalance: number | null,
  outBalStatus: string | null
): boolean {
  return !hasRecordedBalance(outstandingBalance) && !outBalStatus?.trim();
}

export function hasRecordedBalance(outstandingBalance: number | null): boolean {
  return typeof outstandingBalance === "number" && Number.isFinite(outstandingBalance) && outstandingBalance !== 0;
}

export function collectedPounds(
  cashOnCall: number | null,
  paidAfterwards: number | null
): number {
  const onCall = typeof cashOnCall === "number" && Number.isFinite(cashOnCall) ? cashOnCall : 0;
  const afterwards =
    typeof paidAfterwards === "number" && Number.isFinite(paidAfterwards) ? paidAfterwards : 0;
  return onCall + afterwards;
}

export function productLabel(course: string | null, delivery: string | null): string {
  const courseName = course?.trim() || "";
  const deliveryName = delivery?.trim() || "";
  if (!courseName) return "Unspecified offer";
  if (courseName === "Community") return "Community membership";
  if (courseName === "Private Tuition") return "1-1";
  if (courseName === "Beginners Course" && deliveryName === "1-1") return "1-1";
  if (courseName === "Beginners Course") return "Beginner Group";
  if (courseName === "Foundational Course" || courseName === "Refreshers Course") {
    return "Foundational/Refresher";
  }
  return deliveryName ? `${courseName} (${deliveryName})` : courseName;
}

export function isLostOutcome(outcome: string | null): boolean {
  return LOST_OUTCOMES.includes(outcome as (typeof LOST_OUTCOMES)[number]);
}

export function isOpenFollowUp(outcome: string | null, closed: boolean): boolean {
  return !closed && outcome === "Follow Up";
}

export function isOpenPipeline(outcome: string | null, closed: boolean): boolean {
  if (closed) return false;
  if (!outcome) return true;
  return OPEN_PIPELINE_OUTCOMES.includes(outcome as (typeof OPEN_PIPELINE_OUTCOMES)[number]);
}

export function leadSourceBucket(
  source: string | null
): "Paid ad" | "Organic" | "Referral" | "Other" | "Unknown" {
  if (!source?.trim()) return "Unknown";
  const value = source.trim().toLowerCase();
  if (value === "paid social") return "Paid ad";
  if (value === "content" || value === "app signup") return "Organic";
  return "Other";
}

export function salespersonKey(name: string | null): string {
  const trimmed = name?.trim();
  return trimmed || UNASSIGNED_SALESPERSON;
}
