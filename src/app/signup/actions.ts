"use server";

import type { AuthState } from "@/app/login/actions";
import { getPublicAppUrl } from "@/lib/app-url";
import { normalizeReferralCode, REFERRAL_COOKIE_NAME } from "@/lib/referrals/constants";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function signup(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const fullName = formData.get("full_name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!fullName || !email || !password) {
    return { error: "All fields are required." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const cookieStore = await cookies();
  const referralCode = normalizeReferralCode(cookieStore.get(REFERRAL_COOKIE_NAME)?.value);

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        ...(referralCode ? { referral_code: referralCode } : {}),
      },
      emailRedirectTo: `${getPublicAppUrl()}/auth/callback?next=/dashboard/home`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Profile row is created by the handle_new_user DB trigger using user metadata.
  // Upsert here when a session is returned (email confirmation disabled).
  if (data.user && data.session) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      full_name: fullName,
    });

    if (referralCode) {
      await supabase.rpc("register_referral", { p_referral_code: referralCode });
      cookieStore.delete(REFERRAL_COOKIE_NAME);
    }

    redirect("/dashboard/home");
  }

  if (referralCode) {
    cookieStore.delete(REFERRAL_COOKIE_NAME);
  }

  redirect("/login?message=Check your email to confirm your account.");
}
