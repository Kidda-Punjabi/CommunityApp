"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { revalidatePath } from "next/cache";

const LESSON_LOG_PATH = "/admin/lesson-log";

function revalidateLessonLog() {
  revalidatePath(LESSON_LOG_PATH);
  revalidatePath("/admin/packages");
}

export async function fetchAdminLessonLog() {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const { loadAdminLessonLogSnapshot } = await import(
      "@/lib/admin/load-admin-lesson-log"
    );
    const snapshot = await loadAdminLessonLogSnapshot(supabase);
    return { ...snapshot, error: undefined as string | undefined };
  } catch (e) {
    return {
      groups: [],
      totals: {
        entries: 0,
        groups: 0,
        attention: 0,
        unresolvedTutor: 0,
        missingRecording: 0,
        unlinked: 0,
      },
      filters: {
        packages: [] as Array<{
          id: string;
          name: string;
          kind: "cohort" | "package_instance";
        }>,
        tutors: [] as Array<{ id: string; name: string }>,
        statuses: ["Scheduled", "Completed", "Cancelled"] as const,
      },
      error: e instanceof Error ? e.message : "Failed to load lesson log.",
    };
  }
}

export async function refreshLessonLogFromNotion(
  fullSync = false
): Promise<ActionResult & { pulled?: number; skipped?: number }> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const { pullLessonLogFromNotion } = await import("@/lib/notion/lesson-log-sync");
    const result = await pullLessonLogFromNotion(supabase, { fullSync });
    revalidateLessonLog();
    if (result.errors.length > 0) {
      return {
        error: `Pulled ${result.pulled}, skipped ${result.skipped}. First error: ${result.errors[0]}`,
        pulled: result.pulled,
        skipped: result.skipped,
      };
    }
    return {
      success: fullSync
        ? `Full sync: ${result.pulled} upserted, ${result.skipped} skipped.`
        : `Synced ${result.pulled} lesson log entr${result.pulled === 1 ? "y" : "ies"} (${result.skipped} skipped).`,
      pulled: result.pulled,
      skipped: result.skipped,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Lesson log sync failed." };
  }
}
