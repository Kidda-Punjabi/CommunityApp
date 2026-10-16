import "server-only";

import { Resend } from "resend";
import { REQUEST_NOTIFY_FROM } from "@/lib/email/send-request-notify";

const ACCOUNT_DELETION_NOTIFY_TO = "hello@kidda.app";

export async function sendAccountDeletionNotifyEmail(input: {
  name: string;
  email: string;
  stripeCustomerIds: string[];
  stripeSubscriptionIds: string[];
  packageIds: string[];
}): Promise<{ id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { error: "RESEND_API_KEY is not configured." };

  const lines = [
    "A Kidda account was deleted in the app.",
    "",
    `Name: ${input.name || "Unknown"}`,
    `Email: ${input.email}`,
    `Stripe customers: ${input.stripeCustomerIds.join(", ") || "none"}`,
    `Stripe subscriptions cancelled: ${input.stripeSubscriptionIds.join(", ") || "none"}`,
    `Package rows kept, unlinked from the user: ${input.packageIds.join(", ") || "none"}`,
    "",
    "Update Notion by hand. Financial package rows stay in the database without this user.",
  ];

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: REQUEST_NOTIFY_FROM,
    to: ACCOUNT_DELETION_NOTIFY_TO,
    subject: `Account deleted: ${input.email}`,
    text: lines.join("\n"),
  });

  if (error) return { error: error.message };
  return { id: data?.id };
}
