export const KID_PROFILE_COOKIE = "kidda_kid_profile_id";
export const KIDS_PIN_UNLOCKED_COOKIE = "kidda_kids_pin_unlocked";

/** Paths blocked while a kid profile is the active session actor. */
export const KID_BLOCKED_COMMUNITY_PATHS = [
  "/dashboard/community",
  "/dashboard/events",
  "/dashboard/leaderboard",
  "/dashboard/friends",
  "/dashboard/profile/friends",
  "/dashboard/group-games",
  "/dashboard/learn/community",
  "/api/battle",
] as const;

export function isKidBlockedCommunityPath(pathname: string): boolean {
  return KID_BLOCKED_COMMUNITY_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
