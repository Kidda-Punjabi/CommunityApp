"use server";

import { getPublicAppUrl } from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";

export type ResendConfirmationState = {
  error?: string;
  success?: string;
};

export async function resendConfirmationEmail(
  _prev: ResendConfirmationState,
  formData: FormData
): Promise<ResendConfirmationState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email || !email.includes("@")) {
    return { error: "Enter the email you used to sign up." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${getPublicAppUrl()}/auth/callback?next=/dashboard/learn`,
    },
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("rate") || message.includes("security")) {
      return {
        error: "Please wait a minute before requesting another confirmation email.",
      };
    }
    return { error: error.message };
  }

  return {
    success: `Confirmation email sent to ${email}. Check your inbox (and spam) before signing in.`,
  };
}
