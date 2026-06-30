"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import type { AdminPaymentsQuery } from "@/lib/stripe/admin-payment-types";
import { loadAdminStripePayments } from "@/lib/stripe/load-admin-payments";

export async function listAdminStripePayments(query: AdminPaymentsQuery = {}) {
  await requireAdminFromActions();
  return loadAdminStripePayments(query);
}

export async function syncPaymentAccessForEmail(email: string) {
  await requireAdminFromActions();
  const { findUserIdByEmail, syncStripePurchasesForUser } = await import(
    "@/lib/stripe/sync-purchases"
  );

  const userId = await findUserIdByEmail(email);
  if (!userId) {
    return { error: "No app account with this email.", success: undefined };
  }

  const result = await syncStripePurchasesForUser(userId, email);
  if (!result.updated) {
    return {
      error: undefined,
      success: "Account found but no matching Stripe products to grant.",
    };
  }

  return {
    error: undefined,
    success: `Access granted: ${result.unlockedTiers.join(", ")}`,
  };
}

export async function sendPaymentInviteEmail(email: string, productLabel?: string) {
  await requireAdminFromActions();
  const { sendKiddaAccountInvite } = await import("@/lib/auth/send-account-invite");
  return sendKiddaAccountInvite(email, {
    invitedFor: productLabel?.trim() || undefined,
  });
}
