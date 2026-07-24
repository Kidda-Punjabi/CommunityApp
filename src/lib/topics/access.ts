import { hasPremiumAccess } from "@/lib/membership/premium-access";
import { PREMIUM_UNLOCK_PATH } from "@/lib/products/premium-checkout";
import { COMMUNITY_COURSE_ID } from "@/lib/topics/constants";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import type { SupabaseClient } from "@supabase/supabase-js";

/** First N topic weeks are free for everyone (no Premium). */
export const TOPICS_FREE_WEEK_COUNT = 3;

export const TOPICS_SUBSCRIPTION_UNLOCK_URL = PREMIUM_UNLOCK_PATH;

/**
 * Full Topics (Community lessons 4–24) unlock via Premium subscription
 * OR legacy community course_access (purchased Community package).
 * Additive — does not replace Foundational/Beginners course_access.
 */
export async function hasTopicsAccess(
  userId: string,
  supabase?: SupabaseClient
): Promise<boolean> {
  const client = supabase ?? createServiceRoleClient();

  if (await hasPremiumAccess(client, userId)) return true;

  const { data } = await client
    .from("course_access")
    .select("course_id")
    .eq("user_id", userId)
    .eq("course_id", COMMUNITY_COURSE_ID)
    .maybeSingle();

  return Boolean(data);
}

export function isTopicWeekUnlocked(
  weekNumber: number,
  hasSubscription: boolean
): boolean {
  if (weekNumber <= TOPICS_FREE_WEEK_COUNT) return true;
  return hasSubscription;
}
