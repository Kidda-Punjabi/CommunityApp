"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export type ForgotPasswordState = {
  error?: string;
  success?: string;
};

function getBaseUrl(originHeader: string | null, hostHeader: string | null) {
  if (originHeader) return originHeader;

  if (hostHeader) {
    const isLocalHost = hostHeader.includes("localhost");
    const protocol = isLocalHost ? "http" : "https";
    return `${protocol}://${hostHeader}`;
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Please enter your email address." };
  }

  const supabase = await createClient();
  const headerList = await headers();
  const redirectBaseUrl = getBaseUrl(
    headerList.get("origin"),
    headerList.get("host")
  );

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${redirectBaseUrl}/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success:
      "If this email exists, we sent a reset link. Check your inbox and spam folder.",
  };
}
