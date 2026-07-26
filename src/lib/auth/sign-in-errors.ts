import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import type { AuthError } from "@supabase/supabase-js";

export type SignInErrorKind = "no_account" | "wrong_password" | "email_unconfirmed" | "generic";

export type ResolvedSignInError = {
  message: string;
  kind: SignInErrorKind;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isInvalidCredentialsError(error: AuthError): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("invalid login credentials") || message.includes("invalid credentials")
  );
}

type AuthUserLookup = "missing" | "unconfirmed" | "confirmed" | null;

async function lookupAuthUserForEmail(email: string): Promise<AuthUserLookup> {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) return "missing";

  const supabase = createServiceRoleClient();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("[sign-in] listUsers failed while resolving login error:", error.message);
      return null;
    }

    for (const user of data.users) {
      if (user.email && normalizeEmail(user.email) === normalized) {
        return user.email_confirmed_at ? "confirmed" : "unconfirmed";
      }
    }

    if (data.users.length < 200) return "missing";
    page += 1;
  }
}

/** User-facing copy for failed password sign-in (may distinguish account vs password). */
export async function resolveSignInError(
  email: string,
  error: AuthError
): Promise<ResolvedSignInError> {
  const messageLower = error.message.toLowerCase();

  const code = (error as AuthError & { code?: string }).code;
  if (
    code === "email_not_confirmed" ||
    messageLower.includes("email not confirmed")
  ) {
    return {
      kind: "email_unconfirmed",
      message:
        "Confirm your email before signing in. Open the link we sent you — or resend it below.",
    };
  }

  if (!isInvalidCredentialsError(error)) {
    return { kind: "generic", message: error.message };
  }

  // Unconfirmed accounts often surface as invalid credentials — check explicitly.
  const lookup = await lookupAuthUserForEmail(email);
  if (lookup === null) {
    return {
      kind: "generic",
      message:
        "We couldn't sign you in with those details. Check your password, use Forgot password, or sign up if you're new to Kidda.",
    };
  }
  if (lookup === "missing") {
    return {
      kind: "no_account",
      message:
        "We don't have an account with that email yet. If you're new to Kidda, create an account below — or double-check the address you typed.",
    };
  }
  if (lookup === "unconfirmed") {
    return {
      kind: "email_unconfirmed",
      message:
        "Confirm your email before signing in. Open the link we sent you — or resend it below.",
    };
  }

  return {
    kind: "wrong_password",
    message:
      "That password doesn't match this account. Try again or use Forgot password if you need to reset it.",
  };
}
