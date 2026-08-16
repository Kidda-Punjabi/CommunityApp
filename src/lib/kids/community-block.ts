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
