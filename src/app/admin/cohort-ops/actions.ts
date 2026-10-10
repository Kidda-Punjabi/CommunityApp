"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import {
  integrityIssues,
  setupIssues,
  type CohortOpsIssue,
} from "@/lib/admin/dashboard/cohort-ops-issues";
import { loadCohortOpsIssues } from "@/lib/admin/dashboard/load-cohort-ops-issues";
import {
  cohortWeekNumberWriteError,
  guardedClassSessions,
  inspectCohortWeekNumbers,
  parseCohortWeekNumberInput,
  sortCohortWeekSessions,
} from "@/lib/calendar/cohort-week-number-guard";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const INTEGRITY_PATH = "/admin/cohort-session-integrity";

export async function fetchCohortOpsIssueList(kind: "setup" | "integrity"): Promise<{
  issues: CohortOpsIssue[];
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    const result = await loadCohortOpsIssues(supabase);
    return {
      issues: kind === "setup" ? setupIssues(result.issues) : integrityIssues(result.issues),
      error: result.error,
    };
  } catch (error) {
    return {
      issues: [],
      error: error instanceof Error ? error.message : "Could not load cohort issues.",
    };
  }
}

type ClassWeekRow = {
  id: string;
  startsAt: string;
  weekNumber: number | null;
};

async function loadGuardedClassWeeks(
  supabase: SupabaseClient,
  cohortId: string
): Promise<{ rows: ClassWeekRow[]; error?: string }> {
  const { data, error } = await supabase
    .from("tutor_scheduled_sessions")
    .select("id, cohort_id, title, status, match_method, starts_at, week_number")
    .eq("cohort_id", cohortId)
    .neq("status", "cancelled");
  if (error) return { rows: [], error: error.message };
  const rows = guardedClassSessions(
    (data ?? []).map((session) => ({
      id: session.id as string,
      cohort_id: cohortId,
      title: (session.title as string | null) ?? "",
      status: (session.status as string | null) ?? null,
      match_method: (session.match_method as string | null) ?? null,
      starts_at: session.starts_at as string,
      week_number: (session.week_number as number | null) ?? null,
    }))
  ).map((session) => ({
    id: session.id,
    startsAt: session.starts_at,
    weekNumber: session.week_number,
  }));
  return { rows };
}

export async function setCohortSessionWeekNumber(
  sessionId: string,
  weekNumberRaw: string
): Promise<{ error?: string; success?: string }> {
  try {
    const supabase = await requireAdminFromActions();
    const parsed = parseCohortWeekNumberInput(weekNumberRaw);
    if (!parsed.ok) return { error: parsed.error };

    const { data: session, error: sessionError } = await supabase
      .from("tutor_scheduled_sessions")
      .select("id, cohort_id, title, status, match_method, starts_at, week_number")
      .eq("id", sessionId)
      .maybeSingle();
    if (sessionError) return { error: sessionError.message };
    if (!session?.cohort_id) return { error: "Class session not found." };

    const guarded = guardedClassSessions([
      {
        id: session.id as string,
        cohort_id: session.cohort_id as string,
        title: (session.title as string | null) ?? "",
        status: (session.status as string | null) ?? null,
        match_method: (session.match_method as string | null) ?? null,
      },
    ]);
    if (guarded.length === 0) {
      return { error: "That session is not a cohort class, so its week number was left unchanged." };
    }

    const loaded = await loadGuardedClassWeeks(supabase, session.cohort_id as string);
    if (loaded.error) return { error: loaded.error };
    const proposed = loaded.rows.map((row) =>
      row.id === sessionId ? { ...row, weekNumber: parsed.weekNumber } : row
    );
    const weekError = cohortWeekNumberWriteError(proposed);
    if (weekError) return { error: weekError };

    const { error } = await supabase
      .from("tutor_scheduled_sessions")
      .update({ week_number: parsed.weekNumber, updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("cohort_id", session.cohort_id);
    if (error) return { error: error.message };

    revalidatePath(INTEGRITY_PATH);
    return { success: `Week number set to ${parsed.weekNumber}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not set the week number." };
  }
}

export async function renumberCohortClassSessionsByDate(
  cohortId: string
): Promise<{ error?: string; success?: string }> {
  try {
    const supabase = await requireAdminFromActions();
    const loaded = await loadGuardedClassWeeks(supabase, cohortId);
    if (loaded.error) return { error: loaded.error };
    if (loaded.rows.length === 0) return { error: "This cohort has no class sessions to renumber." };

    const planned = sortCohortWeekSessions(loaded.rows).map((row, index) => ({
      ...row,
      weekNumber: index + 1,
    }));
    const weekError = cohortWeekNumberWriteError(planned);
    if (weekError) return { error: weekError };

    const now = new Date().toISOString();
    for (const row of planned) {
      const current = loaded.rows.find((session) => session.id === row.id);
      if (current?.weekNumber === row.weekNumber) continue;
      const { error } = await supabase
        .from("tutor_scheduled_sessions")
        .update({ week_number: row.weekNumber, updated_at: now })
        .eq("id", row.id)
        .eq("cohort_id", cohortId);
      if (error) return { error: error.message };
    }

    revalidatePath(INTEGRITY_PATH);
    return { success: `Renumbered ${planned.length} classes by date.` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not renumber the classes.",
    };
  }
}

export async function acknowledgeCohortWeekGaps(
  cohortId: string
): Promise<{ error?: string; success?: string }> {
  try {
    const supabase = await requireAdminFromActions();
    const { createClient } = await import("@/lib/supabase/server");
    const auth = await createClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const loaded = await loadGuardedClassWeeks(supabase, cohortId);
    if (loaded.error) return { error: loaded.error };
    const gaps = inspectCohortWeekNumbers(loaded.rows).gaps;
    if (gaps.length === 0) return { error: "There is no week gap to mark as intentional." };

    const now = new Date().toISOString();
    const { error } = await supabase.from("cohort_week_gap_acknowledgements").upsert(
      gaps.map((gap) => ({
        cohort_id: cohortId,
        gap_key: gap.key,
        acknowledged_at: now,
        acknowledged_by: user.id,
      })),
      { onConflict: "cohort_id,gap_key" }
    );
    if (error) return { error: error.message };

    revalidatePath(INTEGRITY_PATH);
    return { success: `Marked gap ${gaps.map((gap) => gap.key).join(", ")} as intentional.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not mark the gap." };
  }
}

export async function dismissDuplicateCohortLessonLog(
  entryId: string
): Promise<{ error?: string; success?: string }> {
  try {
    const supabase = await requireAdminFromActions();
    const { createClient } = await import("@/lib/supabase/server");
    const auth = await createClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: entry, error: loadError } = await supabase
      .from("cohort_lesson_log_entries")
      .select("id, cohort_id, lesson_date, dismissed_at")
      .eq("id", entryId)
      .maybeSingle();
    if (loadError) return { error: loadError.message };
    if (!entry) return { error: "Lesson log entry not found." };
    if (!entry.cohort_id) {
      return { error: "Only a cohort lesson log can be dismissed from this page." };
    }
    if (entry.dismissed_at) return { success: "Already dismissed." };

    const lessonDate = String(entry.lesson_date).slice(0, 10);
    const { count, error: countError } = await supabase
      .from("cohort_lesson_log_entries")
      .select("id", { count: "exact", head: true })
      .eq("cohort_id", entry.cohort_id)
      .eq("lesson_date", lessonDate)
      .is("dismissed_at", null);
    if (countError) return { error: countError.message };
    if ((count ?? 0) < 2) {
      return { error: "This date does not have a duplicate lesson log." };
    }

    const { error } = await supabase
      .from("cohort_lesson_log_entries")
      .update({
        dismissed_at: new Date().toISOString(),
        dismissed_by: user.id,
      })
      .eq("id", entryId)
      .is("dismissed_at", null);
    if (error) return { error: error.message };

    const { syncCohortLessonLogLessonIds } = await import(
      "@/lib/lessons/lesson-log-lesson-link"
    );
    await syncCohortLessonLogLessonIds(supabase, entry.cohort_id as string);

    revalidatePath(INTEGRITY_PATH);
    return { success: "Dismissed the duplicate. The row was kept." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not dismiss the duplicate." };
  }
}
