import { getPublicAppUrl } from "@/lib/app-url";
import { ISSUE_AREA_LABELS, type IssueArea } from "@/lib/issues/types";

export type IssueReportEmailPayload = {
  area: IssueArea;
  fullName: string;
  email: string;
  description: string;
  pageUrl: string;
  userAgent: string;
  submittedAt: string;
  attachments: Array<{ name: string; url: string }>;
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatIssueSubmittedAt(iso: string): string {
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

export function issueAdminListUrl(): string {
  return `${getPublicAppUrl()}/admin/issue-reports`;
}

export function buildIssueReportEmail(payload: IssueReportEmailPayload): {
  subject: string;
  text: string;
  html: string;
} {
  const areaLabel = ISSUE_AREA_LABELS[payload.area];
  const fullName = payload.fullName.trim() || "A Kidda user";
  const subject = `[Kidda issue] ${areaLabel} from ${fullName}`;
  const submitted = formatIssueSubmittedAt(payload.submittedAt);
  const adminUrl = issueAdminListUrl();
  const attachmentCount = payload.attachments.length;

  const lines = [
    "A new issue report was submitted.",
    "",
    `Area: ${areaLabel}`,
    `Name: ${fullName}`,
    `Email: ${payload.email.trim() || "Not provided"}`,
    `Submitted: ${submitted}`,
    `Page: ${payload.pageUrl.trim() || "Not provided"}`,
    `Device/browser: ${payload.userAgent.trim() || "Not provided"}`,
    "",
    "Description:",
    payload.description,
    "",
    `Attachments (${attachmentCount}):`,
  ];

  if (attachmentCount === 0) {
    lines.push("None");
  } else {
    for (const attachment of payload.attachments) {
      lines.push(`- ${attachment.name}: ${attachment.url}`);
    }
  }

  lines.push("", `Admin: ${adminUrl}`);

  const text = lines.join("\n");
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#555;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;">${value}</td></tr>`;

  const attachmentHtml =
    attachmentCount === 0
      ? escapeHtml("None")
      : payload.attachments
          .map(
            (attachment) =>
              `<div><a href="${escapeHtml(attachment.url)}">${escapeHtml(attachment.name)}</a></div>`
          )
          .join("");

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.45;color:#111;">
      <p style="margin:0 0 12px;">A new issue report was submitted.</p>
      <table style="border-collapse:collapse;">
        ${row("Area", escapeHtml(areaLabel))}
        ${row("Name", escapeHtml(fullName))}
        ${row("Email", escapeHtml(payload.email.trim() || "Not provided"))}
        ${row("Submitted", escapeHtml(submitted))}
        ${row("Page", linkOrText(payload.pageUrl))}
        ${row("Device/browser", escapeHtml(payload.userAgent.trim() || "Not provided"))}
        ${row("Description", `<pre style="white-space:pre-wrap;font:inherit;margin:0;">${escapeHtml(payload.description)}</pre>`)}
        ${row(`Attachments (${attachmentCount})`, attachmentHtml)}
        ${row("Admin", `<a href="${escapeHtml(adminUrl)}">${escapeHtml(adminUrl)}</a>`)}
      </table>
    </div>
  `.trim();

  return { subject, text, html };
}

function linkOrText(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return escapeHtml("Not provided");
  return `<a href="${escapeHtml(trimmed)}">${escapeHtml(trimmed)}</a>`;
}
