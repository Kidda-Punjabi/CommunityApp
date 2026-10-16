import "server-only";

import { Resend } from "resend";
import { REQUEST_NOTIFY_FROM } from "@/lib/email/send-request-notify";

export async function sendForumReportNotifyEmail(input: {
  to: string;
  reason: string;
  details: string | null;
  excerpt: string;
  authorName: string;
  authorEmail: string;
  reporterName: string;
  reporterEmail: string;
  openReports: number;
  autoHidden: boolean;
  adminUrl: string;
  subjectLabel: string;
}): Promise<{ id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { error: "RESEND_API_KEY is not configured." };

  const recipient = input.to.trim();
  if (!recipient) return { error: "missing ISSUE_REPORT_TO_EMAIL" };

  const text = [
    `Reason: ${input.reason}`,
    `Details: ${input.details?.trim() || "none"}`,
    "",
    "Reported text:",
    input.excerpt,
    "",
    `Author: ${input.authorName} <${input.authorEmail}>`,
    `Reporter: ${input.reporterName} <${input.reporterEmail}>`,
    `Open reports on this item: ${input.openReports}`,
    `Auto-hidden: ${input.autoHidden ? "yes" : "no"}`,
    "",
    `Moderation queue: ${input.adminUrl}`,
  ].join("\n");

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: REQUEST_NOTIFY_FROM,
    to: recipient,
    subject: `Forum report: ${input.reason} - ${input.subjectLabel}`,
    text,
  });

  if (error) return { error: error.message };
  return { id: data?.id };
}
