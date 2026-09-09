export type ProfileNameFields = {
  full_name?: string | null;
  preferred_name?: string | null;
};

const PLACEHOLDER_STUDENT_NAME = /^(student|member|unknown|imported from notion)$/i;

export function isPlaceholderStudentName(name: string | null | undefined): boolean {
  const trimmed = name?.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_STUDENT_NAME.test(trimmed);
}

/** Single source of truth for what name to show a user. */
export function getDisplayName(profile: ProfileNameFields | null | undefined): string | null {
  const preferred = profile?.preferred_name?.trim();
  if (preferred && !isPlaceholderStudentName(preferred)) return preferred;

  const fullName = profile?.full_name?.trim();
  if (fullName && !isPlaceholderStudentName(fullName)) {
    const firstWord = fullName.split(/\s+/)[0];
    return firstWord || null;
  }

  return null;
}

/**
 * Tutor/admin-facing name: preferred name, otherwise the full legal name.
 * Greetings still use {@link getDisplayName} (first name).
 */
export function getStaffFacingName(profile: ProfileNameFields | null | undefined): string | null {
  const preferred = profile?.preferred_name?.trim();
  if (preferred && !isPlaceholderStudentName(preferred)) return preferred;

  const fullName = profile?.full_name?.trim();
  if (fullName && !isPlaceholderStudentName(fullName)) return fullName;

  return null;
}

/** "Sunita De Costa - 1-1 Foundational Course" → "Sunita De Costa". */
export function studentNameFromPackageRunName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed || isPlaceholderStudentName(trimmed)) return null;

  const parts = trimmed
    .split(/\s+[-–—]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const head = parts[0];
  if (parts.length >= 2 && head && !isPlaceholderStudentName(head)) return head;

  return trimmed;
}

export function resolveStudentLabel(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && !isPlaceholderStudentName(trimmed)) return trimmed;
  }
  return "Student";
}

/** First letter for avatar placeholder — uses display-name priority, not raw full_name. */
export function getAvatarInitial(profile: ProfileNameFields | null | undefined): string | null {
  const displayName = getDisplayName(profile);
  if (!displayName) return null;

  const letter = displayName.charAt(0).toUpperCase();
  return /[A-Z0-9\u0A00-\u0A7F]/i.test(letter) ? letter.toUpperCase() : null;
}

/** Preferred name if set, otherwise the first name from full_name — for leaderboard rows. */
export function getLeaderboardName(profile: ProfileNameFields | null | undefined): string {
  return getDisplayName(profile) ?? "Member";
}

export function getGreetingHeading(displayName: string | null): string {
  return displayName ? `Hi, ${displayName}` : "Hello";
}
