export const POINTS_EARNED_EVENT = "kidda:points-earned";

/** Fire a floating +points toast (client-only). */
export function notifyPointsEarned(amount: number) {
  if (typeof window === "undefined" || amount <= 0) return;
  window.dispatchEvent(new CustomEvent(POINTS_EARNED_EVENT, { detail: amount }));
}

export function sumPointsEarned(parts: number[]): number {
  return parts.reduce((sum, value) => sum + (value > 0 ? value : 0), 0);
}
