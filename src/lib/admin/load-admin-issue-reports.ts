import "server-only";

import { parseIssueAttachments, isEmailFailed } from "@/lib/issues/attachments";
import { formatIssueSubmittedAt } from "@/lib/issues/email";
import { ISSUE_AREA_LABELS, ISSUE_ATTACHMENTS_BUCKET, type IssueArea, type IssueAttachment, type IssueReportStatus } from "@/lib/issues/types";
import { isIssueArea } from "@/lib/issues/validation";
import type { SupabaseClient } from "@supabase/supabase-js";

const ADMIN_SIGNED_URL_SECONDS = 60 * 60;

export type AdminIssueAttachmentView = IssueAttachment & {
  signedUrl: string | null;
};

export type AdminIssueReportRow = {
  id: string;
  status: IssueReportStatus;
  area: IssueArea | string;
  areaLabel: string;
  description: string;
  fullName: string;
  email: string;
  pageUrl: string;
  userAgent: string;
  createdAt: string;
  submittedLabel: string;
  adminNotes: string | null;
  resolvedAt: string | null;
  emailFailed: boolean;
  attachments: AdminIssueAttachmentView[];
};

export async function loadOpenIssueReportCreatedAts(
  supabase: SupabaseClient
): Promise<{ createdAts: string[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("issue_reports")
      .select("created_at")
      .eq("status", "open");

    if (error) return { createdAts: [], error: error.message };
    return {
      createdAts: (data ?? []).map((row) => row.created_at as string),
    };
  } catch (e) {
    return {
      createdAts: [],
      error: e instanceof Error ? e.message : "Failed to load open issue reports.",
    };
  }
}

export async function loadAdminIssueReports(
  supabase: SupabaseClient
): Promise<{ rows: AdminIssueReportRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("issue_reports")
      .select(
        "id, status, area, description, full_name, email, page_url, user_agent, attachments, admin_notes, resolved_at, email_sent_at, email_error, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return { rows: [], error: error.message };

    const rows: AdminIssueReportRow[] = [];
    for (const row of data ?? []) {
      const attachments = parseIssueAttachments(row.attachments);
      const views: AdminIssueAttachmentView[] = [];
      for (const attachment of attachments) {
        const { data: signed, error: signError } = await supabase.storage
          .from(ISSUE_ATTACHMENTS_BUCKET)
          .createSignedUrl(attachment.path, ADMIN_SIGNED_URL_SECONDS);
        views.push({
          ...attachment,
          signedUrl: signError ? null : signed?.signedUrl ?? null,
        });
      }

      const area = typeof row.area === "string" ? row.area : "";
      rows.push({
        id: row.id as string,
        status: row.status === "resolved" ? "resolved" : "open",
        area,
        areaLabel: isIssueArea(area) ? ISSUE_AREA_LABELS[area] : area || "Issue",
        description: (row.description as string) ?? "",
        fullName: (row.full_name as string) ?? "Unknown",
        email: (row.email as string) ?? "",
        pageUrl: (row.page_url as string) ?? "",
        userAgent: (row.user_agent as string) ?? "",
        createdAt: row.created_at as string,
        submittedLabel: formatIssueSubmittedAt(row.created_at as string),
        adminNotes: (row.admin_notes as string | null) ?? null,
        resolvedAt: (row.resolved_at as string | null) ?? null,
        emailFailed: isEmailFailed({
          email_sent_at: (row.email_sent_at as string | null) ?? null,
          email_error: (row.email_error as string | null) ?? null,
        }),
        attachments: views,
      });
    }

    return { rows };
  } catch (e) {
    return {
      rows: [],
      error: e instanceof Error ? e.message : "Failed to load issue reports.",
    };
  }
}
