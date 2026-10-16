import "server-only";

import { sendForumReportNotifyEmail } from "@/lib/email/send-forum-report-notify";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";

type ProfileName = { id: string; full_name: string | null; preferred_name: string | null };

function displayName(profile: ProfileName | null): string {
  return profile?.preferred_name?.trim() || profile?.full_name?.trim() || "Member";
}

export async function deliverForumReportEmail(reportId: string, reporterId: string): Promise<void> {
  const admin = createServiceRoleClient();
  const { data: report } = await admin
    .from("forum_reports")
    .select("id, reporter_id, post_id, reply_id, reason, details, email_sent_at")
    .eq("id", reportId)
    .maybeSingle();

  if (!report || report.reporter_id !== reporterId || report.email_sent_at) return;

  const to = process.env.ISSUE_REPORT_TO_EMAIL?.trim() ?? "";
  if (!to) {
    await admin
      .from("forum_reports")
      .update({ email_error: "missing ISSUE_REPORT_TO_EMAIL" })
      .eq("id", reportId)
      .is("email_sent_at", null);
    return;
  }

  const target = report.post_id
    ? await admin.from("forum_posts").select("id, title, body, author_id, status").eq("id", report.post_id).maybeSingle()
    : await admin.from("forum_replies").select("id, body, author_id, status, post_id").eq("id", report.reply_id).maybeSingle();

  const row = target.data as
    | { title?: string; body: string; author_id: string; status: string }
    | null;
  if (!row) {
    await admin.from("forum_reports").update({ email_error: "content missing" }).eq("id", reportId);
    return;
  }

  const authorId = row.author_id;
  const [{ data: profiles }, authorAccount, reporterAccount] = await Promise.all([
    admin.from("profiles").select("id, full_name, preferred_name").in("id", [authorId, reporterId]),
    admin.auth.admin.getUserById(authorId),
    admin.auth.admin.getUserById(reporterId),
  ]);
  const profileRows = (profiles ?? []) as ProfileName[];
  const openQuery = report.post_id
    ? admin.from("forum_reports").select("id", { count: "exact", head: true }).eq("post_id", report.post_id).eq("status", "open")
    : admin.from("forum_reports").select("id", { count: "exact", head: true }).eq("reply_id", report.reply_id).eq("status", "open");
  const { count } = await openQuery;
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://webapp.kidda.app";
  const result = await sendForumReportNotifyEmail({
    to,
    reason: report.reason,
    details: report.details,
    excerpt: (row.body ?? "").slice(0, 500),
    authorName: displayName(profileRows.find((profile) => profile.id === authorId) ?? null),
    authorEmail: authorAccount.data.user?.email ?? "",
    reporterName: displayName(profileRows.find((profile) => profile.id === reporterId) ?? null),
    reporterEmail: reporterAccount.data.user?.email ?? "",
    openReports: count ?? 1,
    autoHidden: row.status === "hidden_pending_review",
    adminUrl: `${origin}/admin/forum-moderation`,
    subjectLabel: row.title?.trim() || "reply",
  });

  if (result.error) {
    await admin
      .from("forum_reports")
      .update({ email_error: result.error.slice(0, 1000) })
      .eq("id", reportId)
      .is("email_sent_at", null);
    return;
  }

  await admin
    .from("forum_reports")
    .update({ email_sent_at: new Date().toISOString(), email_error: null })
    .eq("id", reportId);
}
