import "server-only";

import { Resend } from "resend";
import {
  REQUEST_NOTIFY_FROM,
  REQUEST_NOTIFY_TO,
} from "@/lib/email/send-request-notify";
import {
  buildTutorCohortSwitchNotifyEmail,
  type TutorCohortSwitchNotifyPayload,
} from "@/lib/email/cohort-switch-tutor-notify";

export async function sendTutorCohortSwitchNotifyEmail(
  tutorEmail: string,
  payload: TutorCohortSwitchNotifyPayload
): Promise<{ id?: string; error?: string }> {
  const to = tutorEmail.trim().toLowerCase();
  if (!to) {
    return { error: "Tutor email is required." };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { error: "RESEND_API_KEY is not configured." };
  }

  const { subject, text, html } = buildTutorCohortSwitchNotifyEmail(payload);
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: REQUEST_NOTIFY_FROM,
    to,
    replyTo: REQUEST_NOTIFY_TO,
    subject,
    text,
    html,
  });

  if (error) {
    return { error: error.message };
  }

  return { id: data?.id };
}
