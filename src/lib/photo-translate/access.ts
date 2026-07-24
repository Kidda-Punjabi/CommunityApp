/**
 * Photo Translate is available to all signed-in members.
 * Caps differ by Premium (see photoTranslateCapForPremium).
 * Course purchases (Foundational/Beginners) do not change this gate.
 */
export function canAccessPhotoTranslate(_access?: unknown): boolean {
  return true;
}
