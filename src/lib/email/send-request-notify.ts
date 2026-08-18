import "server-only";

import { Resend } from "resend";
import { getPublicAppUrl } from "@/lib/app-url";

export const REQUEST_NOTIFY_TO = "adnan@kidda.app";
export const REQUEST_NOTIFY_FROM = "Kidda Notifications <notifications@kidda.app>";

export type NotifyRequestType = "cohort_switch" | "lesson_reschedule";

export type NotifyRequestPayload = {
  type: NotifyRequestType;
  request_id: string;
  student_name: string;
  session_title: string;
  starts_at?: string | null;
  from_cohort_name?: string | null;
  to_cohort_name?: string | null;
  message?: string | null;
  preferred_times?: string | null;
  created_at?: string | null;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseNotifyRequestPayload(input: unknown): NotifyRequestPayload | { error: string } {
  if (!input || typeof input !== "object") {
    return { error: "JSON body is required." };
  }

  const body = input as Record<string, unknown>;
  const type = body.type;
  if (type !== "cohort_switch" && type !== "lesson_reschedule") {
    return { error: "type must be cohort_switch or lesson_reschedule." };
  }

  if (!isNonEmptyString(body.request_id)) {
    return { error: "request_id is required." };
  }

  return {
    type,
    request_id: body.request_id.trim(),
    student_name: isNonEmptyString(body.student_name) ? body.student_name.trim() : "A student",
    session_title: isNonEmptyString(body.session_title) ? body.session_title.trim() : "a lesson",
    starts_at: isNonEmptyString(body.starts_at) ? body.starts_at.trim() : null,
    from_cohort_name: isNonEmptyString(body.from_cohort_name) ? body.from_cohort_name.trim() : null,
    to_cohort_name: isNonEmptyString(body.to_cohort_name) ? body.to_cohort_name.trim() : null,
    message: isNonEmptyString(body.message) ? body.message.trim() : null,
    preferred_times: isNonEmptyString(body.preferred_times) ? body.preferred_times.trim() : null,
    created_at: isNonEmptyString(body.created_at) ? body.created_at.trim() : null,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "Not specified";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function buildRequestNotifyEmail(payload: NotifyRequestPayload): {
  subject: string;
  text: string;
  html: string;
} {
  const isSwitch = payload.type === "cohort_switch";
  const requestType = isSwitch ? "Cohort Switch Request" : "Session Reschedule Request";
  const adminPath = isSwitch ? "/admin/cohort-switch-requests" : "/admin/reschedule-requests";
  const adminUrl = `${getPublicAppUrl()}${adminPath}`;
  const subject = `${isSwitch ? "Cohort switch request" : "Session reschedule request"} — ${payload.student_name}`;

  const lines = [
    requestType,
    "",
    `Student: ${payload.student_name}`,
    `Session: ${payload.session_title}`,
    `Date/time: ${formatWhen(payload.starts_at)}`,
  ];

  if (isSwitch) {
    lines.push(
      `From cohort: ${payload.from_cohort_name ?? "Unknown"}`,
      `To cohort: ${payload.to_cohort_name ?? "Unknown"}`
    );
  }

  if (payload.preferred_times) {
    lines.push(`Preferred times: ${payload.preferred_times}`);
  }
  if (payload.message) {
    lines.push("", "Message:", payload.message);
  }

  lines.push("", `Admin: ${adminUrl}`, `Request ID: ${payload.request_id}`);
  if (payload.created_at) {
    lines.push(`Submitted: ${formatWhen(payload.created_at)}`);
  }

  const text = lines.join("\n");
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#555;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;">${value}</td></tr>`;

  const htmlRows = [
    row("Request type", escapeHtml(requestType)),
    row("Student", escapeHtml(payload.student_name)),
    row("Session", escapeHtml(payload.session_title)),
    row("Date/time", escapeHtml(formatWhen(payload.starts_at))),
  ];

  if (isSwitch) {
    htmlRows.push(
      row("From cohort", escapeHtml(payload.from_cohort_name ?? "Unknown")),
      row("To cohort", escapeHtml(payload.to_cohort_name ?? "Unknown"))
    );
  }
  if (payload.preferred_times) {
    htmlRows.push(row("Preferred times", escapeHtml(payload.preferred_times)));
  }
  if (payload.message) {
    htmlRows.push(row("Message", `<pre style="white-space:pre-wrap;font:inherit;margin:0;">${escapeHtml(payload.message)}</pre>`));
  }
  htmlRows.push(
    row("Admin page", `<a href="${escapeHtml(adminUrl)}">${escapeHtml(adminUrl)}</a>`),
    row("Request ID", escapeHtml(payload.request_id))
  );
  if (payload.created_at) {
    htmlRows.push(row("Submitted", escapeHtml(formatWhen(payload.created_at))));
  }

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.45;color:#111;">
      <p style="margin:0 0 12px;">A new ${escapeHtml(requestType.toLowerCase())} needs handling.</p>
      <table style="border-collapse:collapse;">${htmlRows.join("")}</table>
    </div>
  `.trim();

  return { subject, text, html };
}

export async function sendRequestNotifyEmail(payload: NotifyRequestPayload): Promise<{ id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { error: "RESEND_API_KEY is not configured." };
  }

  const { subject, text, html } = buildRequestNotifyEmail(payload);
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: REQUEST_NOTIFY_FROM,
    to: REQUEST_NOTIFY_TO,
    subject,
    text,
    html,
  });

  if (error) {
    return { error: error.message };
  }

  return { id: data?.id };
}
