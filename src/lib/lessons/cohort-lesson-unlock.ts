import "server-only";

import { isCountableLessonLogStatus } from "@/lib/lessons/lesson-log-progress";
import { resolveCurriculumLessonForLogEntry } from "@/lib/lessons/lesson-log-roster";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UnlockCohortLessonResult =
  | { ok: true; lessonId: string }
  | { ok: false; reason: string };

/** Upsert cohort_lesson_unlocks for a curriculum lesson. */
export async function unlockLessonForCohort(
  supabase: SupabaseClient,
  options: {
    cohortId: string;
    lessonId: string;
    unlockedBy: string;
  }
): Promise<UnlockCohortLessonResult> {
  const { error } = await supabase.from("cohort_lesson_unlocks").upsert(
    {
      cohort_id: options.cohortId,
      lesson_id: options.lessonId,
      unlocked_by: options.unlockedBy,
      unlocked_at: new Date().toISOString(),
    },
    { onConflict: "cohort_id,lesson_id" }
  );

  if (error) return { ok: false, reason: error.message };
  return { ok: true, lessonId: options.lessonId };
}

function isMissingAutoUnlockColumn(message: string): boolean {
  return message.toLowerCase().includes("auto_unlock_on_log");
}

/** Read per-cohort auto-unlock preference (defaults true if column not migrated). */
export async function cohortAutoUnlockOnLogEnabled(
  supabase: SupabaseClient,
  cohortId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("cohorts")
    .select("auto_unlock_on_log")
    .eq("id", cohortId)
    .maybeSingle();

  if (error) {
    if (isMissingAutoUnlockColumn(error.message)) return true;
    throw error;
  }
  return data?.auto_unlock_on_log !== false;
}

/**
 * After a session is logged in-app, unlock linked curriculum content when the
 * cohort's auto_unlock_on_log is enabled (default).
 */
export async function maybeAutoUnlockAfterLessonLog(
  supabase: SupabaseClient,
  options: {
    cohortId: string;
    entryId: string;
    unlockedBy: string | null;
  }
): Promise<UnlockCohortLessonResult | { ok: false; skipped: true; reason: string }> {
  if (!options.unlockedBy) {
    return { ok: false, skipped: true, reason: "No unlocked_by user." };
  }

  const autoUnlock = await cohortAutoUnlockOnLogEnabled(supabase, options.cohortId);
  if (!autoUnlock) {
    return { ok: false, skipped: true, reason: "Auto-unlock on log is off for this cohort." };
  }

  const { data: entry, error: entryError } = await supabase
    .from("cohort_lesson_log_entries")
    .select("id, cohort_id, lesson_id, status")
    .eq("id", options.entryId)
    .maybeSingle();

  if (entryError) return { ok: false, reason: entryError.message };
  if (!entry?.cohort_id) {
    return { ok: false, skipped: true, reason: "Not a cohort log entry." };
  }

  if (!isCountableLessonLogStatus(entry.status as string | null)) {
    return { ok: false, skipped: true, reason: "Cancelled sessions are not auto-unlocked." };
  }

  let lessonId = entry.lesson_id as string | null;
  if (!lessonId) {
    const curriculum = await resolveCurriculumLessonForLogEntry(
      supabase,
      entry.cohort_id,
      entry.id
    );
    lessonId = curriculum?.lessonId ?? null;
  }

  if (!lessonId) {
    return { ok: false, reason: "No curriculum lesson linked for this log entry." };
  }

  return unlockLessonForCohort(supabase, {
    cohortId: options.cohortId,
    lessonId,
    unlockedBy: options.unlockedBy,
  });
}
