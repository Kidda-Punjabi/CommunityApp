/**
 * Verify auto-unlock on log (3-step test case).
 *
 *   node --env-file=.env.local --import tsx scripts/verify-auto-unlock-on-log.ts
 */
import { createRequire } from "node:module";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
require("module").Module._cache[require.resolve("server-only")] = {
  id: "x",
  filename: "x",
  loaded: true,
  exports: {},
};

const COHORT_ID = process.env.VERIFY_COHORT_ID?.trim() || "1c464e99-cc54-4523-bc44-2f4bfd01d165";

async function ensureMigration(supabase: SupabaseClient) {
  const { error } = await supabase
    .from("cohorts")
    .select("auto_unlock_on_log")
    .eq("id", COHORT_ID)
    .maybeSingle();
  if (error?.message?.toLowerCase().includes("auto_unlock_on_log")) {
    throw new Error(
      "Apply supabase/cohort-auto-unlock-on-log.sql first (node --import tsx scripts/apply-cohort-auto-unlock-on-log.ts)."
    );
  }
}

async function setAutoUnlock(supabase: SupabaseClient, enabled: boolean) {
  const { error } = await supabase
    .from("cohorts")
    .update({ auto_unlock_on_log: enabled })
    .eq("id", COHORT_ID);
  if (error) throw new Error(`setAutoUnlock: ${error.message}`);
}

async function unlockRowForLesson(
  supabase: SupabaseClient,
  lessonId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("cohort_lesson_unlocks")
    .select("lesson_id")
    .eq("cohort_id", COHORT_ID)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (error) throw new Error(`unlockRowForLesson: ${error.message}`);
  return Boolean(data);
}

async function entryLessonId(supabase: SupabaseClient, entryId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("cohort_lesson_log_entries")
    .select("lesson_id")
    .eq("id", entryId)
    .maybeSingle();
  if (error) throw new Error(`entryLessonId: ${error.message}`);
  return (data?.lesson_id as string | null) ?? null;
}

async function deleteTestEntry(supabase: SupabaseClient, entryId: string, notionPageId: string) {
  await supabase.from("cohort_lesson_log_entries").delete().eq("id", entryId);
  try {
    const { notionJson } = await import("../src/lib/notion/client.ts");
    await notionJson(`/pages/${notionPageId}`, { method: "PATCH", body: JSON.stringify({ archived: true }) });
  } catch {
    // best-effort cleanup
  }
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await ensureMigration(supabase);

  const { createLessonLogInNotionAndSupabase } = await import(
    "../src/lib/notion/lesson-log-sync.ts"
  );
  const { unlockLessonForCohort } = await import("../src/lib/lessons/cohort-lesson-unlock.ts");
  const { syncCohortLessonLogLessonIds } = await import(
    "../src/lib/lessons/lesson-log-lesson-link.ts"
  );

  const { data: cohort } = await supabase
    .from("cohorts")
    .select("tutor_id, auto_unlock_on_log")
    .eq("id", COHORT_ID)
    .maybeSingle();
  if (!cohort?.tutor_id) throw new Error("Cohort missing tutor_id for logged_by.");

  const loggedBy = cohort.tutor_id as string;
  const today = new Date().toISOString().slice(0, 10);
  const date1 = `${today.slice(0, 4)}-12-01`;
  const date2 = `${today.slice(0, 4)}-12-08`;
  const date3 = `${today.slice(0, 4)}-12-15`;

  const created: Array<{ entryId: string; notionPageId: string; lessonId: string | null }> = [];

  try {
    console.log("Step 1: auto_unlock ON — log session, expect unlock row…");
    await setAutoUnlock(supabase, true);
    const step1 = await createLessonLogInNotionAndSupabase(supabase, {
      cohortId: COHORT_ID,
      lessonDate: date1,
      notes: "verify-auto-unlock step 1",
      loggedBy,
      status: "Completed",
    });
    if (!step1.ok) throw new Error(`Step 1 create failed: ${step1.error}`);
    await syncCohortLessonLogLessonIds(supabase, COHORT_ID);
    const lesson1 = await entryLessonId(supabase, step1.entryId);
    const unlocked1 = lesson1 ? await unlockRowForLesson(supabase, lesson1) : false;
    created.push({ entryId: step1.entryId, notionPageId: step1.notionPageId, lessonId: lesson1 });
    console.log(
      unlocked1
        ? `  PASS — cohort_lesson_unlocks row for lesson ${lesson1}`
        : `  FAIL — no unlock row for lesson ${lesson1}`
    );

    console.log("Step 2: auto_unlock OFF — log next session, expect NO unlock row…");
    await setAutoUnlock(supabase, false);
    const step2 = await createLessonLogInNotionAndSupabase(supabase, {
      cohortId: COHORT_ID,
      lessonDate: date2,
      notes: "verify-auto-unlock step 2",
      loggedBy,
      status: "Completed",
    });
    if (!step2.ok) throw new Error(`Step 2 create failed: ${step2.error}`);
    await syncCohortLessonLogLessonIds(supabase, COHORT_ID);
    const lesson2 = await entryLessonId(supabase, step2.entryId);
    const unlocked2 = lesson2 ? await unlockRowForLesson(supabase, lesson2) : false;
    created.push({ entryId: step2.entryId, notionPageId: step2.notionPageId, lessonId: lesson2 });
    console.log(
      !unlocked2
        ? `  PASS — no cohort_lesson_unlocks row for lesson ${lesson2}`
        : `  FAIL — unexpected unlock row for lesson ${lesson2}`
    );

    console.log("Step 3: auto_unlock still OFF — manual unlock on step 2 entry…");
    if (!lesson2) throw new Error("Step 2 entry has no lesson_id.");
    const manual = await unlockLessonForCohort(supabase, {
      cohortId: COHORT_ID,
      lessonId: lesson2,
      unlockedBy: loggedBy,
    });
    const unlocked3 = manual.ok ? await unlockRowForLesson(supabase, lesson2) : false;
    console.log(
      unlocked3
        ? `  PASS — manual unlock created row for lesson ${lesson2}`
        : `  FAIL — manual unlock did not create row (${manual.ok ? "unknown" : manual.reason})`
    );
  } finally {
    await setAutoUnlock(supabase, true);
    for (const row of created.reverse()) {
      if (row.lessonId) {
        await supabase
          .from("cohort_lesson_unlocks")
          .delete()
          .eq("cohort_id", COHORT_ID)
          .eq("lesson_id", row.lessonId);
      }
      await deleteTestEntry(supabase, row.entryId, row.notionPageId);
    }
    await syncCohortLessonLogLessonIds(supabase, COHORT_ID);
    console.log("Cleanup: removed test log entries, unlock rows, restored auto_unlock_on_log=true.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
