"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import { loadAdminIssueReports } from "@/lib/admin/load-admin-issue-reports";
import { revalidatePath } from "next/cache";

const PATH = "/admin/issue-reports";

export async function fetchAdminIssueReports() {
  try {
    const supabase = await requireAdminFromActions();
    return loadAdminIssueReports(supabase);
  } catch (e) {
    return {
      rows: [],
      error: e instanceof Error ? e.message : "Failed to load issue reports.",
    };
  }
}

export async function resolveAdminIssueReport(input: {
  reportId: string;
  adminNotes?: string;
}): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const { createClient } = await import("@/lib/supabase/server");
    const auth = await createClient();
    const {
      data: { user: adminUser },
    } = await auth.auth.getUser();
    if (!adminUser) return { error: "Unauthorized" };

    const { data: report, error: loadError } = await supabase
      .from("issue_reports")
      .select("id, status")
      .eq("id", input.reportId)
      .maybeSingle();

    if (loadError || !report) return { error: "Report not found." };
    if (report.status !== "open") return { error: "Already resolved." };

    const note = input.adminNotes?.trim() || null;
    const { error } = await supabase
      .from("issue_reports")
      .update({
        status: "resolved",
        admin_notes: note,
        resolved_at: new Date().toISOString(),
        resolved_by: adminUser.id,
      })
      .eq("id", input.reportId)
      .eq("status", "open");

    if (error) return { error: error.message };

    revalidatePath(PATH);
    revalidatePath("/admin");
    revalidatePath("/admin/content");
    return { success: "Marked resolved." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to resolve report." };
  }
}

export async function reopenAdminIssueReport(input: {
  reportId: string;
}): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();

    const { data: report, error: loadError } = await supabase
      .from("issue_reports")
      .select("id, status")
      .eq("id", input.reportId)
      .maybeSingle();

    if (loadError || !report) return { error: "Report not found." };
    if (report.status !== "resolved") return { error: "This report is already open." };

    const { error } = await supabase
      .from("issue_reports")
      .update({
        status: "open",
        resolved_at: null,
        resolved_by: null,
      })
      .eq("id", input.reportId)
      .eq("status", "resolved");

    if (error) return { error: error.message };

    revalidatePath(PATH);
    revalidatePath("/admin");
    revalidatePath("/admin/content");
    return { success: "Reopened." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to reopen report." };
  }
}
