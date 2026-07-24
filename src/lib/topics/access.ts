/**
 * Topics subscription access — stub until Stripe subscription wiring lands.
 * Replace `hasTopicsAccess` with real billing/period checks from Part A.
 */

/** First N topic weeks are free for everyone (no subscription). */
export const TOPICS_FREE_WEEK_COUNT = 3;

export const TOPICS_SUBSCRIPTION_UNLOCK_URL = "/courses/community";

/**
 * Whether the user has an active Topics (£30/quarter) subscription.
 * Stub: always false so weeks 4–24 stay locked in the UI until billing ships.
 */
export async function hasTopicsAccess(_userId: string): Promise<boolean> {
  return false;
}

export function isTopicWeekUnlocked(
  weekNumber: number,
  hasSubscription: boolean
): boolean {
  if (weekNumber <= TOPICS_FREE_WEEK_COUNT) return true;
  return hasSubscription;
}
