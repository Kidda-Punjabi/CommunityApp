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

  await persistLastUser(supabase);

  const next = safeNextPath(formData.get("next") as string | null);
  redirect(next);
}
