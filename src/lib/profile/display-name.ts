export type ProfileNameFields = {
  full_name?: string | null;
  preferred_name?: string | null;
};

/** Single source of truth for what name to show a user. */
export function getDisplayName(profile: ProfileNameFields | null | undefined): string | null {
  const preferred = profile?.preferred_name?.trim();
  if (preferred) return preferred;

  const fullName = profile?.full_name?.trim();
  if (fullName) {
    const firstWord = fullName.split(/\s+/)[0];
    return firstWord || null;
  }

  return null;
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
