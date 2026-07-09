import type { CourseAccessContext } from "@/lib/membership/unlocked";

/**
 * Photo Translate is for paid members only — same gate as Live Translate
 * (`course_access` via `isFreeOnly`, not legacy `profiles.membership_tier`).
 */
export function canAccessPhotoTranslate(access: CourseAccessContext): boolean {
  return !access.isFreeOnly;
}
