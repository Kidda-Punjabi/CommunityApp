import "server-only";

import { Resend } from "resend";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import { REQUEST_NOTIFY_FROM } from "@/lib/email/send-request-notify";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendSessionRebookConfirmationEmails(params: {
  studentEmail: string | null;
  tutorEmail: string | null;
  studentName: string;
  tutorName: string;
  lessonTitle: string;
  startsAt: string;
  endsAt: string;
  meetLink: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const when = formatSessionWhen(params.startsAt, params.endsAt);
  const meetLine = params.meetLink ? `\nMeet link: ${params.meetLink}` : "";
  const meetHtml = params.meetLink
    ? `<p><a href="${escapeHtml(params.meetLink)}">Join lesson</a></p>`
    : "";

  const resend = new Resend(apiKey);
  const sends: Array<Promise<unknown>> = [];

  if (params.studentEmail) {
    sends.push(
      resend.emails.send({
        from: REQUEST_NOTIFY_FROM,
        to: params.studentEmail,
        subject: `Lesson rebooked — ${params.lessonTitle}`,
        text: [
          `Hi ${params.studentName},`,
          "",
          `Your £35 rebook is confirmed. Your lesson with ${params.tutorName} is now:`,
          when,
          meetLine.trim(),
          "",
          "See you then — Kidda",
        ]
          .filter(Boolean)
          .join("\n"),
        html: `
          <p>Hi ${escapeHtml(params.studentName)},</p>
          <p>Your £35 rebook is confirmed. Your lesson with <strong>${escapeHtml(
            params.tutorName
          )}</strong> is now:</p>
          <p><strong>${escapeHtml(when)}</strong></p>
          ${meetHtml}
          <p>See you then — Kidda</p>
        `,
      })
    );
  }

  if (params.tutorEmail) {
    sends.push(
      resend.emails.send({
        from: REQUEST_NOTIFY_FROM,
        to: params.tutorEmail,
        subject: `Paid rebook confirmed — ${params.studentName}`,
        text: [
          `Hi ${params.tutorName},`,
          "",
          `${params.studentName} paid the £35 rebook fee. Their lesson is now:`,
          `${params.lessonTitle}`,
          when,
          meetLine.trim(),
          "",
          "Kidda",
        ]
          .filter(Boolean)
          .join("\n"),
        html: `
          <p>Hi ${escapeHtml(params.tutorName)},</p>
          <p><strong>${escapeHtml(
            params.studentName
          )}</strong> paid the £35 rebook fee. Their lesson is now:</p>
          <p>${escapeHtml(params.lessonTitle)}<br/><strong>${escapeHtml(when)}</strong></p>
          ${meetHtml}
          <p>Kidda</p>
        `,
      })
    );
  }

  if (sends.length === 0) {
    throw new Error("No student or tutor email available for rebook confirmation.");
  }

  const results = await Promise.all(sends);
  for (const result of results) {
    const error = (result as { error?: { message?: string } | null })?.error;
    if (error) {
      throw new Error(error.message ?? "Resend email failed.");
    }
  }
}
