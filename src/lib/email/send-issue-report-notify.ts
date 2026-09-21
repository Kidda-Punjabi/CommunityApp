import "server-only";

import { Resend } from "resend";
import { REQUEST_NOTIFY_FROM } from "@/lib/email/send-request-notify";
import {
  buildIssueReportEmail,
  type IssueReportEmailPayload,
} from "@/lib/issues/email";

export async function sendIssueReportNotifyEmail(
  to: string,
  replyTo: string | null,
  payload: IssueReportEmailPayload
): Promise<{ id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { error: "RESEND_API_KEY is not configured." };
  }

  const recipient = to.trim();
  if (!recipient) {
    return { error: "missing ISSUE_REPORT_TO_EMAIL" };
  }

  const { subject, text, html } = buildIssueReportEmail(payload);
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: REQUEST_NOTIFY_FROM,
    to: recipient,
    ...(replyTo?.trim() ? { replyTo: replyTo.trim() } : {}),
    subject,
    text,
    html,
  });

  if (error) {
    return { error: error.message };
  }

  return { id: data?.id };
}
