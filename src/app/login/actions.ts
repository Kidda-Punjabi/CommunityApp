"use server";

import { persistLastUser } from "@/lib/auth/remember-last-user";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import { resolveSignInError, type SignInErrorKind } from "@/lib/auth/sign-in-errors";

export type AuthState = {
  error?: string;
  errorKind?: SignInErrorKind;
};

export async function login(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const resolved = await resolveSignInError(email, error);
    return { error: resolved.message, errorKind: resolved.kind };
  }

  // Heal purchase grants for already-linked leads. Password login never hits
  // /auth/callback (that path is code-exchange only: email confirm / magic link).
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      const { createServiceRoleClient } = await import("@/lib/supabase/admin-server");
      const { maybeGrantAccessForLinkedProfile } = await import(
        "@/lib/notion/lead-purchase-access-grant"
      );
      await maybeGrantAccessForLinkedProfile(createServiceRoleClient(), user.id);
    }
  } catch (grantError) {
    console.error(
      "[login] lead purchase grant heal failed:",
      grantError instanceof Error ? grantError.message : grantError
    );
  }

  await persistLastUser(supabase);

  const next = safeNextPath(formData.get("next") as string | null);
  redirect(next);
}
