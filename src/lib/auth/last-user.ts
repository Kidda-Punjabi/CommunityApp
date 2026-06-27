export const LAST_USER_COOKIE = "kidda_last_user";
export const LAST_USER_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type LastUserPayload = {
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

export function lastUserCookieOptions() {
  return {
    maxAge: LAST_USER_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
  };
}

export function serializeLastUser(payload: LastUserPayload): string {
  return JSON.stringify(payload);
}

export function parseLastUser(value: string | undefined | null): LastUserPayload | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<LastUserPayload>;
    if (typeof parsed.email !== "string" || typeof parsed.displayName !== "string") {
      return null;
    }

    return {
      email: parsed.email,
      displayName: parsed.displayName,
      avatarUrl: typeof parsed.avatarUrl === "string" ? parsed.avatarUrl : null,
    };
  } catch {
    return null;
  }
}

export function lastUserFromAuthMetadata(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): LastUserPayload | null {
  if (!user.email) return null;

  const preferred =
    typeof user.user_metadata?.preferred_name === "string"
      ? user.user_metadata.preferred_name.trim()
      : "";
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";
  const firstName = fullName ? fullName.split(/\s+/)[0] : "";
  const displayName = preferred || firstName || user.email.split("@")[0];
  const avatarUrl =
    typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null;

  return { email: user.email, displayName, avatarUrl };
}
