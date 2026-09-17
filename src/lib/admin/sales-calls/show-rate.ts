export const SHOW_RATE_EXCLUDED_OUTCOMES = ["Cancelled", "Rescheduled"] as const;

export const SHOW_RATE_NO_SHOW_OUTCOME = "No Show";

export const SHOW_RATE_SHOWED_OUTCOMES = [
  "Closed",
  "Follow Up",
  "Rebook",
  "Enrolment Call Booked",
  "Check-In Call Booked",
  "Can't Afford",
  "Not Interested",
  "Refunded",
  "Interested in Kids Classes",
  "Interested in Sikhi Classes",
  "Interested in Reading/Writing",
] as const;

const EXCLUDED = new Set<string>(SHOW_RATE_EXCLUDED_OUTCOMES);
const SHOWED = new Set<string>(SHOW_RATE_SHOWED_OUTCOMES);

function outcomeValue(outcome: string | null | undefined): string {
  return outcome?.trim() ?? "";
}

export function isShowRateEligible(
  outcome: string | null | undefined,
  showUp: boolean
): boolean {
  const value = outcomeValue(outcome);
  if (!value && !showUp) return false;
  if (EXCLUDED.has(value)) return false;
  return true;
}

export function isShowedCall(outcome: string | null | undefined, showUp: boolean): boolean {
  if (!isShowRateEligible(outcome, showUp)) return false;
  const value = outcomeValue(outcome);
  if (value === SHOW_RATE_NO_SHOW_OUTCOME) return false;
  if (SHOWED.has(value)) return true;
  return showUp;
}

export function isEnrolmentCallBooked(outcome: string | null | undefined): boolean {
  return outcomeValue(outcome) === "Enrolment Call Booked";
}

export function isCheckInCallBooked(outcome: string | null | undefined): boolean {
  return outcomeValue(outcome) === "Check-In Call Booked";
}
