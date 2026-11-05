import { getPublicAppUrl } from "@/lib/app-url";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";

export type SendAccountInviteResult = {
  success?: string;
  error?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Send a Supabase invite email so the recipient can create their Kidda account. */
export async function sendKiddaAccountInvite(
  email: string,
  options?: { invitedFor?: string }
): Promise<SendAccountInviteResult> {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) {
    return { error: "A valid email address is required." };
  }

  const supabase = createServiceRoleClient();
  const redirectTo = `${getPublicAppUrl()}/auth/callback?next=/dashboard/home`;

  const { error } = await supabase.auth.admin.inviteUserByEmail(normalized, {
    redirectTo,
    data: {
      invited_via: "admin_payment",
      ...(options?.invitedFor ? { invited_for: options.invitedFor } : {}),
    },
  });

  if (error) {
    const message = error.message.toLowerCase();

    if (message.includes("already been registered") || message.includes("already registered")) {
      return {
        error:
          "This email already has a Kidda account. Use Re-sync access instead of sending an invite.",
      };
    }

    return { error: error.message };
  }

  return {
    success: `Invite sent to ${normalized}. They can set a password and sign in — course access syncs when they open Learn.`,
  };
}
