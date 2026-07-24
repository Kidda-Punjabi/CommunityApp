"use server";

import type { AuthState } from "@/app/login/actions";
import { persistLastUser } from "@/lib/auth/remember-last-user";
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
  // Link Notion lead whenever we have a user id (session optional): confirmation-required
  // signups still get both profiles.notion_lead_page_id and Notion App User ID; auth
  // callback re-runs as a heal if this race loses to the trigger.
  if (data.user) {
    try {
      const { createServiceRoleClient } = await import("@/lib/supabase/admin-server");
      const { linkLeadsForProfile } = await import("@/lib/notion/lead-sync");
      const service = createServiceRoleClient();
      await service.from("profiles").upsert({
        id: data.user.id,
        full_name: fullName,
      });
      const linkResult = await linkLeadsForProfile(service, data.user.id, email, { fullName });
      const { maybeGrantAccessAfterLeadLink } = await import(
        "@/lib/notion/lead-purchase-access-grant"
      );
      await maybeGrantAccessAfterLeadLink(service, data.user.id, linkResult);
    } catch {
      // Notion lead linking is best-effort and should not block signup.
    }
  }

  if (data.user && data.session) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      full_name: fullName,
    });

    if (referralCode) {
      await supabase.rpc("register_referral", { p_referral_code: referralCode });
      cookieStore.delete(REFERRAL_COOKIE_NAME);
    }

    await persistLastUser(supabase);

    redirect("/dashboard/home");
  }

  if (referralCode) {
    cookieStore.delete(REFERRAL_COOKIE_NAME);
  }

  // Supabase anti-enumeration: an already-confirmed email yields user + no session
  // and identities.length === 0, with no confirmation email sent.
  // UNVERIFIED: existing-but-unconfirmed may return identities.length > 0 with no
  // session — we fall through below (normal path; Supabase may resend confirmation).
  const likelyExistingConfirmedAccount =
    Boolean(data.user) &&
    !data.session &&
    (data.user?.identities?.length ?? 0) === 0;

  if (likelyExistingConfirmedAccount) {
    const redirectTo = `${getPublicAppUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    if (resetError) {
      console.error(
        `[signup] resetPasswordForEmail after duplicate signUp failed for ${email.trim()}:`,
        resetError.message
      );
    }
  }

  redirect("/login?message=Check your email to confirm your account.");
}
