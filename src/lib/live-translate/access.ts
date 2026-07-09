import type { CourseAccessContext } from "@/lib/membership/unlocked";

/**
 * Live Translate is for paid members only.
 * Matches other premium gates: course_access via `isFreeOnly`, not legacy
 * `profiles.membership_tier` (which uses foundational/beginners/community).
 */
export function canAccessLiveTranslate(access: CourseAccessContext): boolean {
  return !access.isFreeOnly;
}
