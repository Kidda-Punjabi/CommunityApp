/**
 * Verify app→Notion lesson-log write-back updates an existing page instead of duplicating.
 *
 *   node --env-file=.env.local --import tsx scripts/verify-lesson-log-dedupe.ts
 */
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
require("module").Module._cache[require.resolve("server-only")] = {
  id: "x",
  filename: "x",
  loaded: true,
  exports: {},
};

const COHORT_ID = "1c464e99-cc54-4523-bc44-2f4bfd01d165";
const LESSON_DATE = "2029-06-15";
const MARKER = `https://example.com/kidda-dedupe-verify-${Date.now()}`;

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { createLessonLogInNotionAndSupabase } = await import(
    "../src/lib/notion/lesson-log-sync.ts"
  );
  const { notionJson } = await import("../src/lib/notion/client.ts");

  const { data: unlocksBefore } = await supabase
    .from("cohort_lesson_unlocks")
    .select("lesson_id")
    .eq("cohort_id", COHORT_ID);
  const unlockSet = new Set((unlocksBefore ?? []).map((row) => row.lesson_id as string));

  const { data: existing } = await supabase
    .from("cohort_lesson_log_entries")
    .select("id")
    .eq("cohort_id", COHORT_ID)
    .eq("lesson_date", LESSON_DATE);
  if ((existing ?? []).length > 0) {
    throw new Error(`Refusing to run: ${existing?.length} row(s) already exist for ${LESSON_DATE}`);
  }

  let entryId: string | null = null;
  let notionPageId: string | null = null;
  let lessonId: string | null = null;

  try {
    console.log("1) First create (empty date, like a new Notion-synced slot)…");
    const created = await createLessonLogInNotionAndSupabase(supabase, {
      cohortId: COHORT_ID,
      lessonDate: LESSON_DATE,
      notes: "dedupe-verify create",
      status: "Scheduled",
    });
    if (!created.ok) throw new Error(created.error);
    entryId = created.entryId;
    notionPageId = created.notionPageId;
    console.log("   entry", entryId, "page", notionPageId);

    await supabase
      .from("cohort_lesson_log_entries")
      .update({ source: "notion" })
      .eq("id", entryId);

    console.log("2) Second write with recording (must PATCH existing page)…");
    const updated = await createLessonLogInNotionAndSupabase(supabase, {
      cohortId: COHORT_ID,
      lessonDate: LESSON_DATE,
      recordingUrl: MARKER,
      status: "Completed",
    });
    if (!updated.ok) throw new Error(updated.error);
    console.log("   entry", updated.entryId, "page", updated.notionPageId);

    const { data: rowsAfterUpdate } = await supabase
      .from("cohort_lesson_log_entries")
      .select("id, source, notion_page_id, recording_url, status")
      .eq("cohort_id", COHORT_ID)
      .eq("lesson_date", LESSON_DATE);

    const notionPage = await notionJson<{
      id: string;
      properties: Record<string, unknown>;
    }>(`/pages/${notionPageId}`);
    const recording = (notionPage.properties["Recording Link"] as { url?: string | null })?.url;

    console.log("   supabase rows", JSON.stringify(rowsAfterUpdate, null, 2));
    console.log("   notion recording", recording);

    if ((rowsAfterUpdate ?? []).length !== 1) {
      throw new Error(`FAIL: expected 1 row, got ${rowsAfterUpdate?.length}`);
    }
    if (updated.entryId !== entryId) {
      throw new Error("FAIL: second write created a different row id");
    }
    if (updated.notionPageId !== notionPageId) {
      throw new Error("FAIL: second write created a different Notion page");
    }
    if (rowsAfterUpdate?.[0]?.recording_url !== MARKER) {
      throw new Error("FAIL: recording_url not saved on existing row");
    }
    if (recording !== MARKER) {
      throw new Error("FAIL: existing Notion page was not updated with recording");
    }

    console.log("3) Rapid double-submit…");
    const [a, b] = await Promise.all([
      createLessonLogInNotionAndSupabase(supabase, {
        cohortId: COHORT_ID,
        lessonDate: LESSON_DATE,
        notes: "dedupe-verify race A",
        recordingUrl: MARKER,
        status: "Completed",
      }),
      createLessonLogInNotionAndSupabase(supabase, {
        cohortId: COHORT_ID,
        lessonDate: LESSON_DATE,
        notes: "dedupe-verify race B",
        recordingUrl: MARKER,
        status: "Completed",
      }),
    ]);
    if (!a.ok) throw new Error(`race A: ${a.error}`);
    if (!b.ok) throw new Error(`race B: ${b.error}`);

    const { data: rowsAfterRace } = await supabase
      .from("cohort_lesson_log_entries")
      .select("id, notion_page_id")
      .eq("cohort_id", COHORT_ID)
      .eq("lesson_date", LESSON_DATE);

    console.log("   race results", {
      a: { entryId: a.entryId, notionPageId: a.notionPageId },
      b: { entryId: b.entryId, notionPageId: b.notionPageId },
      rows: rowsAfterRace,
    });

    if ((rowsAfterRace ?? []).length !== 1) {
      throw new Error(`FAIL: race left ${rowsAfterRace?.length} rows`);
    }
    if (a.notionPageId !== notionPageId || b.notionPageId !== notionPageId) {
      throw new Error("FAIL: race created a new Notion page");
    }

    const { data: linked } = await supabase
      .from("cohort_lesson_log_entries")
      .select("lesson_id")
      .eq("id", entryId)
      .maybeSingle();
    lessonId = (linked?.lesson_id as string | null) ?? null;

    console.log("PASS: existing Notion page updated; no duplicate row/page.");
  } finally {
    if (entryId) {
      await supabase.from("cohort_lesson_log_entries").delete().eq("id", entryId);
    }
    if (notionPageId) {
      try {
        await notionJson(`/pages/${notionPageId}`, {
          method: "PATCH",
          body: JSON.stringify({ archived: true }),
        });
      } catch (error) {
        console.warn("archive failed", error);
      }
    }
    if (lessonId && !unlockSet.has(lessonId)) {
      await supabase
        .from("cohort_lesson_unlocks")
        .delete()
        .eq("cohort_id", COHORT_ID)
        .eq("lesson_id", lessonId);
      await supabase
        .from("lesson_recordings")
        .delete()
        .eq("cohort_id", COHORT_ID)
        .eq("lesson_id", lessonId);
    }
    const { syncCohortLessonLogLessonIds } = await import(
      "../src/lib/lessons/lesson-log-lesson-link.ts"
    );
    await syncCohortLessonLogLessonIds(supabase, COHORT_ID);
    console.log("Cleanup done.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
