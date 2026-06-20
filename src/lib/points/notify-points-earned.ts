export const POINTS_EARNED_EVENT = "kidda:points-earned";
export const XP_EARNED_EVENT = "kidda:xp-earned";

/** Fire a floating +points toast (client-only). */
export function notifyPointsEarned(amount: number) {
  if (typeof window === "undefined" || amount <= 0) return;
  window.dispatchEvent(new CustomEvent(POINTS_EARNED_EVENT, { detail: amount }));
}

/** Fire a floating +XP toast (client-only). */
export function notifyXpEarned(amount: number) {
  if (typeof window === "undefined" || amount <= 0) return;
  window.dispatchEvent(new CustomEvent(XP_EARNED_EVENT, { detail: amount }));
}

/** Notify weekly leaderboard points and lifetime XP separately. */
export function notifyActivityRewards(weekly: number, xp: number) {
  notifyPointsEarned(weekly);
  notifyXpEarned(xp);
}

export function sumPointsEarned(parts: number[]): number {
  return parts.reduce((sum, value) => sum + (value > 0 ? value : 0), 0);
}
