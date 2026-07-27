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

const AUTO_UNLOCK_VIEW_TYPE = "cohort_auto_unlock_on_log";

async function readAutoUnlockFromSavedView(
  supabase: SupabaseClient,
  cohortId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("admin_saved_views")
    .select("config")
    .eq("view_type", AUTO_UNLOCK_VIEW_TYPE)
    .eq("name", cohortId)
    .maybeSingle();

  if (error || !data) return true;
  const config = data.config as { auto_unlock_on_log?: boolean } | null;
  return config?.auto_unlock_on_log !== false;
}

/** Read per-cohort auto-unlock preference (defaults true). */
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
    if (isMissingAutoUnlockColumn(error.message)) {
      return readAutoUnlockFromSavedView(supabase, cohortId);
    }
    throw error;
  }
  return data?.auto_unlock_on_log !== false;
}

/** Persist per-cohort auto-unlock preference (column preferred; saved-view fallback pre-migration). */
export async function setCohortAutoUnlockOnLogEnabled(
  supabase: SupabaseClient,
  options: {
    cohortId: string;
    enabled: boolean;
    updatedBy: string;
  }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { error } = await supabase
    .from("cohorts")
    .update({ auto_unlock_on_log: options.enabled })
    .eq("id", options.cohortId);

  if (!error) return { ok: true };

  if (!isMissingAutoUnlockColumn(error.message)) {
    return { ok: false, reason: error.message };
  }

  const { data: existing } = await supabase
    .from("admin_saved_views")
    .select("id")
    .eq("view_type", AUTO_UNLOCK_VIEW_TYPE)
    .eq("name", options.cohortId)
    .maybeSingle();

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("admin_saved_views")
      .update({ config: { auto_unlock_on_log: options.enabled } })
      .eq("id", existing.id);
    if (updateError) return { ok: false, reason: updateError.message };
    return { ok: true };
  }

  const { error: insertError } = await supabase.from("admin_saved_views").insert({
    view_type: AUTO_UNLOCK_VIEW_TYPE,
    name: options.cohortId,
    config: { auto_unlock_on_log: options.enabled },
    created_by: options.updatedBy,
  });
  if (insertError) return { ok: false, reason: insertError.message };
  return { ok: true };
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
