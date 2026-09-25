export type ParentEntryDecision = "enter-kid" | "picker" | "stay";

/**
 * Where a parent lands when no kid profile is active yet.
 * Accounts that already have their own adult course stay on the parent home
 * (or the existing PIN picker). Auto-enter only applies when they do not.
 */
export function decideParentEntry(input: {
  kidCount: number;
  hasOwnAdultCourse: boolean;
  pickedWhoThisSession: boolean;
  activeKidProfileId: string | null;
  viewAsActive: boolean;
}): ParentEntryDecision {
  if (
    input.viewAsActive ||
    input.activeKidProfileId ||
    input.pickedWhoThisSession ||
    input.hasOwnAdultCourse ||
    input.kidCount <= 0
  ) {
    return "stay";
  }
  if (input.kidCount === 1) return "enter-kid";
  return "picker";
}
