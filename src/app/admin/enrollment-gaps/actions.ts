"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import { loadEnrollmentGaps } from "@/lib/admin/load-enrollment-gaps";
import type { EnrollmentGapsSnapshot } from "@/lib/admin/enrollment-gaps-types";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const PATH = "/admin/enrollment-gaps";

export async function fetchEnrollmentGaps(): Promise<EnrollmentGapsSnapshot> {
  try {
    const supabase = await requireAdminFromActions();
    return loadEnrollmentGaps(supabase);
  } catch (error) {
    return {
      grantQueue: [],
      missingAccess: [],
      error: error instanceof Error ? error.message : "Failed to load enrollment gaps.",
    };
  }
}

export async function markGrantQueueResolved(
  queueId: string,
  resolutionNote: string
): Promise<ActionResult> {
  try {
    const note = resolutionNote.trim();
    if (!note) return { error: "Resolution note is required." };
    if (!queueId.trim()) return { error: "Queue item is required." };

    const supabase = await requireAdminFromActions();
    const auth = await createClient();
    const {
      data: { user: adminUser },
    } = await auth.auth.getUser();
    if (!adminUser) return { error: "Unauthorized" };

    const { data, error } = await supabase
      .from("notion_lead_purchase_grant_queue")
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: adminUser.id,
        resolution_note: note,
      })
      .eq("id", queueId)
      .eq("resolved", false)
      .select("id")
      .maybeSingle();

    if (error) return { error: error.message };
    if (!data) return { error: "Queue item not found or already resolved." };

    revalidatePath(PATH);
    revalidatePath("/admin");
    return { success: "Marked resolved." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to mark resolved.",
    };
  }
}
