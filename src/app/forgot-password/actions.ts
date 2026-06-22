"use server";

import { AUTH_RECOVERY_COOKIE } from "@/lib/auth/recovery-flow";
import { getPublicAppUrl } from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export type ForgotPasswordState = {
  error?: string;
  success?: string;
};

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Please enter your email address." };
  }

  const supabase = await createClient();
  const redirectTo = `${getPublicAppUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    return { error: error.message };
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_RECOVERY_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60,
    path: "/",
  });

  return {
    success:
      "If this email exists, we sent a reset link. Check your inbox and spam folder.",
  };
}
