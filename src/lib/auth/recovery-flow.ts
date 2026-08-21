export const AUTH_RECOVERY_COOKIE = "auth_recovery_pending";

const POST_AUTH_PATH = "/dashboard/learn";

/** Where to send the user after /auth/callback exchanges a PKCE code. */
export function authCallbackNextPath(
  type: string | null | undefined,
  hasRecoveryCookie: boolean
): string {
  if (type === "signup" || type === "email" || type === "magiclink") {
    return POST_AUTH_PATH;
  }

  // Password reset emails often land on Site URL with only ?code= (no type).
  if (type === "recovery" || hasRecoveryCookie || !type) {
    return "/reset-password";
  }

  return POST_AUTH_PATH;
}

export function buildAuthCallbackUrl(origin: string, code: string, next: string): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", next);
  url.searchParams.set("code", code);
  return url.toString();
}
