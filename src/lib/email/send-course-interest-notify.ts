import "server-only";

import { Resend } from "resend";
import { getPublicAppUrl } from "@/lib/app-url";
import { REQUEST_NOTIFY_FROM, REQUEST_NOTIFY_TO } from "@/lib/email/send-request-notify";

export type CourseInterestEmailPayload = {
  fullName: string;
  email: string | null;
  courseTitle: string;
  timelineLabel: string;
  hot: boolean;
  kidName: string | null;
  pipelineName: string;
  ghlStatus: string;
  registeredAt: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-GB", {
    timeZone: "Europe/London",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function buildCourseInterestEmail(payload: CourseInterestEmailPayload): {
  subject: string;
  text: string;
  html: string;
} {
  const who = payload.kidName ? `${payload.fullName} (for ${payload.kidName})` : payload.fullName;
  const subject = `${payload.hot ? "HOT: " : ""}${who} registered interest in ${payload.courseTitle} (${payload.timelineLabel})`;
  const adminUrl = `${getPublicAppUrl()}/admin/content/people/interest`;

  const rows: Array<[string, string]> = [
    ["Name", payload.fullName],
    ...(payload.kidName ? ([["Kid", payload.kidName]] as Array<[string, string]>) : []),
    ["Email", payload.email ?? "Not on file"],
    ["Course", payload.courseTitle],
    ["Wants to start", payload.timelineLabel],
    ["GHL", `${payload.ghlStatus} (${payload.pipelineName})`],
    ["Registered", formatWhen(payload.registeredAt)],
  ];

  const text = [
    "Someone registered interest in the app.",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    `All interest: ${adminUrl}`,
  ].join("\n");

  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#555;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;">${escapeHtml(value)}</td></tr>`
    )
    .join("");

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.45;color:#111;">
      <p style="margin:0 0 12px;">Someone registered interest in the app.</p>
      <table style="border-collapse:collapse;">${htmlRows}</table>
      <p style="margin:16px 0 0;"><a href="${escapeHtml(adminUrl)}">See all interest in admin</a></p>
    </div>
  `.trim();

  return { subject, text, html };
}

export async function sendCourseInterestNotifyEmail(
  payload: CourseInterestEmailPayload
): Promise<{ id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { error: "RESEND_API_KEY is not configured." };

  const { subject, text, html } = buildCourseInterestEmail(payload);
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: REQUEST_NOTIFY_FROM,
    to: REQUEST_NOTIFY_TO,
    ...(payload.email ? { replyTo: payload.email } : {}),
    subject,
    text,
    html,
  });
  if (error) return { error: error.message };
  return { id: data?.id };
}
