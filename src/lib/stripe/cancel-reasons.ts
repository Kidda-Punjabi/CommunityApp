/** Reasons a member can give when cancelling. Shared by the Billing page and the cancel API. */
export const CANCEL_REASONS = {
  too_expensive: { label: "It's too expensive", feedback: "too_expensive" },
  not_using: { label: "I'm not using it enough", feedback: "unused" },
  times: { label: "The session times don't suit me", feedback: "other" },
  other: { label: "Something else", feedback: "other" },
} as const;

export type CancelReason = keyof typeof CANCEL_REASONS;

export function isCancelReason(value: unknown): value is CancelReason {
  return typeof value === "string" && value in CANCEL_REASONS;
}
