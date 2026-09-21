import { NextResponse } from "next/server";
import { sendIssueReportNotifyEmail } from "@/lib/email/send-issue-report-notify";
import { parseIssueAttachments } from "@/lib/issues/attachments";
import { issueAdminListUrl } from "@/lib/issues/email";
import { issueErrorMessage } from "@/lib/issues/error-message";
import { ISSUE_ATTACHMENTS_BUCKET, ISSUE_RATE_LIMIT_MAX, ISSUE_RATE_LIMIT_WINDOW_MS } from "@/lib/issues/types";
import { isIssueArea } from "@/lib/issues/validation";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  let reportId = "";
  try {
    const json = (await request.json()) as { reportId?: unknown };
    reportId = typeof json.reportId === "string" ? json.reportId.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!reportId) {
    return NextResponse.json({ error: "reportId is required." }, { status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    const { data: report, error: loadError } = await admin
      .from("issue_reports")
      .select(
        "id, user_id, area, description, full_name, email, page_url, user_agent, attachments, created_at, email_sent_at, email_error"
      )
      .eq("id", reportId)
      .maybeSingle();

    if (loadError || !report) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    if (report.user_id !== user.id) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    if (report.email_sent_at) {
      return NextResponse.json({ ok: true, alreadySent: true });
    }

    const since = new Date(Date.now() - ISSUE_RATE_LIMIT_WINDOW_MS).toISOString();
    const { count, error: countError } = await admin
      .from("issue_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since)
      .neq("id", reportId);

    if (countError) {
      console.error("[issue-reports] rate limit count failed", countError.message);
    } else if ((count ?? 0) >= ISSUE_RATE_LIMIT_MAX) {
      await admin
        .from("issue_reports")
        .update({ email_error: "rate_limited" })
        .eq("id", reportId)
        .is("email_sent_at", null);
      return NextResponse.json({ ok: true, rateLimited: true });
    }

    const to = process.env.ISSUE_REPORT_TO_EMAIL?.trim() ?? "";
    if (!to) {
      console.error("[issue-reports] missing ISSUE_REPORT_TO_EMAIL");
      await admin
        .from("issue_reports")
        .update({ email_error: "missing ISSUE_REPORT_TO_EMAIL" })
        .eq("id", reportId)
        .is("email_sent_at", null);
      return NextResponse.json({ ok: true });
    }

    if (!isIssueArea(report.area)) {
      await admin
        .from("issue_reports")
        .update({ email_error: "invalid area" })
        .eq("id", reportId)
        .is("email_sent_at", null);
      return NextResponse.json({ ok: true });
    }

    const attachments = parseIssueAttachments(report.attachments);
    const signed: Array<{ name: string; url: string }> = [];
    for (const attachment of attachments) {
      const { data, error } = await admin.storage
        .from(ISSUE_ATTACHMENTS_BUCKET)
        .createSignedUrl(attachment.path, SIGNED_URL_SECONDS);
      signed.push({
        name: attachment.name,
        url: error || !data?.signedUrl ? `${issueAdminListUrl()} (link unavailable)` : data.signedUrl,
      });
    }

    const result = await sendIssueReportNotifyEmail(to, report.email, {
      area: report.area,
      fullName: report.full_name ?? "",
      email: report.email ?? "",
      description: report.description ?? "",
      pageUrl: report.page_url ?? "",
      userAgent: report.user_agent ?? "",
      submittedAt: report.created_at ?? new Date().toISOString(),
      attachments: signed,
    });

    if (result.error) {
      console.error("[issue-reports] notify failed", {
        reportId,
        error: result.error,
      });
      await admin
        .from("issue_reports")
        .update({ email_error: result.error.slice(0, 1000) })
        .eq("id", reportId)
        .is("email_sent_at", null);
      return NextResponse.json({ ok: true });
    }

    await admin
      .from("issue_reports")
      .update({ email_sent_at: new Date().toISOString(), email_error: null })
      .eq("id", reportId);

    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    console.error("[issue-reports] notify unhandled", issueErrorMessage(error));
    return NextResponse.json({ ok: true });
  }
}
