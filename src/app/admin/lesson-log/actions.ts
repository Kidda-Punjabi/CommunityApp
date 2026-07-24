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
        createTargets: [] as Array<{
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

export async function createAdminLessonLogEntry(input: {
  kind: "cohort" | "package_instance";
  runId: string;
  lessonDate: string;
  notes?: string;
  recordingUrl?: string;
  status?: "Scheduled" | "Completed" | "Cancelled";
}): Promise<ActionResult & { entryId?: string; notionPageId?: string }> {
  try {
    await requireAdminFromActions();
    const { createClient } = await import("@/lib/supabase/server");
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const supabase = createServiceRoleClient();
    const { createLessonLogInNotionAndSupabase } = await import(
      "@/lib/notion/lesson-log-sync"
    );
    const result = await createLessonLogInNotionAndSupabase(supabase, {
      cohortId: input.kind === "cohort" ? input.runId : null,
      packageInstanceId: input.kind === "package_instance" ? input.runId : null,
      lessonDate: input.lessonDate,
      notes: input.notes?.trim() || null,
      recordingUrl: input.recordingUrl?.trim() || null,
      status: input.status ?? "Completed",
      loggedBy: user.id,
    });
    if (!result.ok) return { error: result.error };
    revalidateLessonLog();
    revalidatePath("/dashboard/tutor/log-lesson");
    return {
      success: "Lesson logged in the app and Notion.",
      entryId: result.entryId,
      notionPageId: result.notionPageId,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create lesson log." };
  }
}

export async function updateAdminLessonLogFields(
  entryId: string,
  fields: {
    status?: "Scheduled" | "Completed" | "Cancelled" | null;
    reviewed?: boolean;
    notes?: string | null;
  }
): Promise<ActionResult> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const { updateLessonLogManualFields } = await import("@/lib/notion/lesson-log-sync");
    const result = await updateLessonLogManualFields(supabase, entryId, fields);
    if (!result.ok) return { error: result.error };
    revalidateLessonLog();
    return {
      success:
        "Saved as manual override — Notion pull will not overwrite these fields until reset.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update lesson log." };
  }
}

export async function resetAdminLessonLogFieldsToNotion(
  entryId: string,
  fields: Array<"status" | "reviewed" | "notes">
): Promise<ActionResult> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const { resetLessonLogFieldsToNotion } = await import("@/lib/notion/lesson-log-sync");
    const result = await resetLessonLogFieldsToNotion(supabase, entryId, fields);
    if (!result.ok) return { error: result.error };
    revalidateLessonLog();
    return { success: "Reset from Notion — pull may update these fields again." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to reset lesson log fields." };
  }
}

/** Mark attention as handled without linking (sets reviewed = manual). */
export async function dismissAdminLessonLogAttention(
  entryId: string
): Promise<ActionResult> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const { updateLessonLogManualFields } = await import("@/lib/notion/lesson-log-sync");
    const result = await updateLessonLogManualFields(supabase, entryId, {
      reviewed: true,
    });
    if (!result.ok) return { error: result.error };
    revalidateLessonLog();
    return {
      success: "Dismissed from Needs attention (marked reviewed).",
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to dismiss lesson log attention.",
    };
  }
}
