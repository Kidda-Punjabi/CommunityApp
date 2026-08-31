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
    if (input.kind === "cohort") {
      revalidatePath("/dashboard/learn");
      revalidatePath(`/admin/packages/${input.runId}`);
    }
    return {
      success: result.reusedExisting
        ? "This lesson was already logged — updated the existing entry in the app and Notion."
        : "Lesson logged in the app and Notion.",
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
    recordingUrl?: string | null;
  }
): Promise<ActionResult> {
  try {
    await requireAdminFromActions();
    const { createClient } = await import("@/lib/supabase/server");
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    const supabase = createServiceRoleClient();
    const { updateLessonLogManualFields } = await import("@/lib/notion/lesson-log-sync");
    const result = await updateLessonLogManualFields(supabase, entryId, {
      ...fields,
      dismissedBy: user?.id ?? null,
      uploadedBy: user?.id ?? null,
    });
    if (!result.ok) return { error: result.error };
    revalidateLessonLog();
    revalidatePath("/dashboard/learn");
    return {
      success: fields.recordingUrl !== undefined
        ? "Saved. Recording is available to students in Learn when this entry is linked to a lesson."
        : "Saved status, reviewed, and notes.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update lesson log." };
  }
}

/**
 * Dedicated student-facing recording save — writes the log URL and lesson_recordings.
 * Does not push to Notion.
 */
export async function saveAdminLessonLogRecordingForLearn(
  entryId: string,
  recordingUrl: string
): Promise<ActionResult> {
  try {
    await requireAdminFromActions();
    const { createClient } = await import("@/lib/supabase/server");
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const url = recordingUrl.trim();
    if (!url) return { error: "Paste a recording URL first." };
    if (!/^https?:\/\//i.test(url)) {
      return { error: "Recording URL must start with http:// or https://" };
    }

    const supabase = createServiceRoleClient();
    const { data: entry, error: loadError } = await supabase
      .from("cohort_lesson_log_entries")
      .select("id, cohort_id, lesson_id")
      .eq("id", entryId)
      .maybeSingle();

    if (loadError) return { error: loadError.message };
    if (!entry) return { error: "Lesson log entry not found." };
    if (!entry.cohort_id) {
      return { error: "This entry isn’t linked to a cohort, so it can’t show in Learn." };
    }

    const { error: logError } = await supabase
      .from("cohort_lesson_log_entries")
      .update({ recording_url: url })
      .eq("id", entryId);
    if (logError) return { error: logError.message };

    // Ensure curriculum lesson_id is linked before syncing student-facing recordings.
    const { syncCohortLessonLogLessonIds } = await import(
      "@/lib/lessons/lesson-log-lesson-link"
    );
    await syncCohortLessonLogLessonIds(supabase, entry.cohort_id);

    const { data: linked } = await supabase
      .from("cohort_lesson_log_entries")
      .select("lesson_id")
      .eq("id", entryId)
      .maybeSingle();

    const lessonId = (linked?.lesson_id as string | null) ?? (entry.lesson_id as string | null);
    if (!lessonId) {
      return {
        error:
          "Saved on the log, but this entry isn’t linked to a curriculum lesson yet — open Unlock / link the lesson, then save again.",
      };
    }

    const { syncCohortLessonRecordingFromLog } = await import(
      "@/lib/tutoring/sync-cohort-recording-from-log"
    );
    await syncCohortLessonRecordingFromLog(supabase, {
      cohortId: entry.cohort_id,
      lessonId,
      recordingUrl: url,
      uploadedBy: user.id,
    });

    revalidateLessonLog();
    revalidatePath("/dashboard/learn");
    return { success: "Recording saved for students in Learn." };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to save recording for Learn.",
    };
  }
}

export async function unlockAdminLessonLogEntry(entryId: string): Promise<ActionResult> {
  try {
    await requireAdminFromActions();
    const { createClient } = await import("@/lib/supabase/server");
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const supabase = createServiceRoleClient();
    const { data: entry, error: loadError } = await supabase
      .from("cohort_lesson_log_entries")
      .select("id, cohort_id, lesson_id, status")
      .eq("id", entryId)
      .maybeSingle();

    if (loadError) return { error: loadError.message };
    if (!entry) return { error: "Lesson log entry not found." };
    if (!entry.cohort_id) {
      return { error: "Only cohort lesson logs can be unlocked for students." };
    }

    let lessonId = entry.lesson_id as string | null;
    if (!lessonId) {
      const { resolveCurriculumLessonForLogEntry } = await import(
        "@/lib/lessons/lesson-log-roster"
      );
      const curriculum = await resolveCurriculumLessonForLogEntry(
        supabase,
        entry.cohort_id,
        entry.id
      );
      lessonId = curriculum?.lessonId ?? null;
    }

    if (!lessonId) {
      return {
        error:
          "No curriculum lesson linked yet. Cancelled entries are excluded — ensure this log entry is in the lesson sequence.",
      };
    }

    const { unlockLessonForCohort } = await import("@/lib/lessons/cohort-lesson-unlock");
    const result = await unlockLessonForCohort(supabase, {
      cohortId: entry.cohort_id,
      lessonId,
      unlockedBy: user.id,
    });

    if (!result.ok) return { error: result.reason };

    revalidateLessonLog();
    revalidatePath("/admin/packages");
    revalidatePath("/dashboard/learn");
    revalidatePath("/dashboard/tutor");
    return { success: "Lesson unlocked for this cohort in Learn." };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to unlock lesson.",
    };
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

/** Mark an unlinked entry as acknowledged (no Notion Package to resolve). */
export async function dismissAdminLessonLogAttention(
  entryId: string
): Promise<ActionResult> {
  try {
    await requireAdminFromActions();
    const { createClient } = await import("@/lib/supabase/server");
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const supabase = createServiceRoleClient();
    const { data: entry, error: loadError } = await supabase
      .from("cohort_lesson_log_entries")
      .select("id, cohort_id, package_instance_id, dismissed_at")
      .eq("id", entryId)
      .maybeSingle();

    if (loadError) return { error: loadError.message };
    if (!entry) return { error: "Lesson log entry not found." };
    if (entry.cohort_id || entry.package_instance_id) {
      return {
        error:
          "Only unlinked entries (no cohort/package) can be dismissed. Link the package instead.",
      };
    }
    if (entry.dismissed_at) {
      return { success: "Already dismissed." };
    }

    const { error } = await supabase
      .from("cohort_lesson_log_entries")
      .update({
        dismissed_at: new Date().toISOString(),
        dismissed_by: user.id,
      })
      .eq("id", entryId)
      .is("cohort_id", null)
      .is("package_instance_id", null);

    if (error) {
      if (error.message.includes("dismissed_at")) {
        return {
          error: `${error.message} Run supabase/cohort-lesson-log-dismiss.sql first.`,
        };
      }
      return { error: error.message };
    }

    revalidateLessonLog();
    return { success: "Dismissed — removed from Needs attention." };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to dismiss lesson log attention.",
    };
  }
}

export async function fetchAdminLessonLogRoster(entryId: string) {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const { loadLessonLogRosterContext } = await import(
      "@/lib/lessons/lesson-log-roster"
    );
    const result = await loadLessonLogRosterContext(supabase, entryId);
    if ("error" in result) {
      return { error: result.error, context: null };
    }
    return { context: result, error: undefined as string | undefined };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to load attendance roster.",
      context: null,
    };
  }
}

export async function saveAdminLessonLogAttendanceHomework(
  entryId: string,
  marks: Array<{
    studentId: string;
    attended: boolean;
    homeworkCompleted: boolean;
  }>
): Promise<
  ActionResult & {
    unmatchedPresent?: Array<{ studentId: string; studentName: string }>;
    unmatchedHomework?: Array<{ studentId: string; studentName: string }>;
    notionPushed?: boolean;
  }
> {
  try {
    await requireAdminFromActions();
    const { createClient } = await import("@/lib/supabase/server");
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const supabase = createServiceRoleClient();
    const { saveLessonLogAttendanceHomework } = await import(
      "@/lib/lessons/save-lesson-log-attendance-homework"
    );
    const result = await saveLessonLogAttendanceHomework(supabase, {
      lessonLogEntryId: entryId,
      marks,
      markedBy: user.id,
    });

    if (!result.ok) return { error: result.error };

    revalidateLessonLog();
    revalidatePath("/dashboard/tutor/attendance");

    const unmatchedNames = [
      ...new Set([
        ...result.unmatchedPresent.map((s) => s.studentName),
        ...result.unmatchedHomework.map((s) => s.studentName),
      ]),
    ];

    let success = `Saved attendance + homework for ${result.savedAttendance} student${result.savedAttendance === 1 ? "" : "s"}`;
    if (result.curriculumLessonTitle) {
      success += ` (${result.curriculumLessonTitle})`;
    }
    if (result.notionPushed) {
      success += " and pushed Attendees/Homework to Notion.";
    } else {
      success +=
        " in the app. No Notion page linked on this log entry — Notion was not updated.";
    }
    if (result.homeworkTableMissing) {
      success +=
        " Note: app homework table not migrated yet (Notion Homework still updated). Run supabase/cohort-lesson-homework.sql.";
    }
    if (unmatchedNames.length > 0) {
      success += ` Warning: no Notion Lead App User ID for: ${unmatchedNames.join(", ")}.`;
    }

    return {
      success,
      unmatchedPresent: result.unmatchedPresent,
      unmatchedHomework: result.unmatchedHomework,
      notionPushed: result.notionPushed,
    };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Failed to save attendance/homework.",
    };
  }
}
