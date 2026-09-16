"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import { loadSyncHealth } from "@/lib/admin/sync-health/load-sync-health";
import type { SyncHealthSnapshot } from "@/lib/admin/sync-health/types";
import { retryLeadPurchaseGrantQueueItem } from "@/lib/notion/lead-purchase-access-grant";
import { retryLessonLogPageFromNotion } from "@/lib/notion/lesson-log-sync";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type { SyncHealthSnapshot } from "@/lib/admin/sync-health/types";

const PATH = "/admin/sync-health";

function revalidateSyncHealth() {
  revalidatePath(PATH);
  revalidatePath("/admin");
}

export async function fetchSyncHealth(): Promise<SyncHealthSnapshot> {
  try {
    const supabase = await requireAdminFromActions();
    return loadSyncHealth(supabase);
  } catch (error) {
    return {
      lastRun: null,
      watermarks: [],
      lock: { held: false, holder: null, acquiredAt: null, expiresAt: null },
      lessonErrors: [],
      failures: [],
      conflicts: [],
      grantQueue: [],
      error: error instanceof Error ? error.message : "Failed to load sync health.",
    };
  }
}

export async function retryLessonLogSyncRow(notionPageId: string): Promise<ActionResult> {
  try {
    const id = notionPageId.trim();
    if (!id) return { error: "Notion page id is required." };
    const supabase = await requireAdminFromActions();
    const result = await retryLessonLogPageFromNotion(supabase, id);
    revalidateSyncHealth();
    if (!result.ok) return { error: result.error };
    return { success: "Pulled this Lessons Log page from Notion." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Retry failed." };
  }
}

export async function resolveLeadLinkConflict(conflictId: string): Promise<ActionResult> {
  try {
    const id = conflictId.trim();
    if (!id) return { error: "Conflict id is required." };
    const supabase = await requireAdminFromActions();
    const { data, error } = await supabase
      .from("notion_lead_link_conflicts")
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("resolved", false)
      .select("id")
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "Conflict not found or already resolved." };
    revalidateSyncHealth();
    return { success: "Marked resolved. It will not re-log unless a new conflict appears." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to resolve conflict." };
  }
}

export async function retryGrantQueueItem(queueId: string): Promise<ActionResult> {
  try {
    const id = queueId.trim();
    if (!id) return { error: "Queue item is required." };
    const supabase = await requireAdminFromActions();
    const auth = await createClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) return { error: "Unauthorized" };
    const result = await retryLeadPurchaseGrantQueueItem(supabase, {
      queueId: id,
      resolvedBy: user.id,
    });
    revalidateSyncHealth();
    return result;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Grant retry failed." };
  }
}
