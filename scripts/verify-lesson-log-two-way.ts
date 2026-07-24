/**
 * Verify Lesson Log two-way create + manual override.
 * Requires supabase/cohort-lesson-log-manual-source.sql applied.
 *
 *   node --env-file=.env.local --import tsx scripts/verify-lesson-log-two-way.ts
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

const COHORT_38 = "1c464e99-cc54-4523-bc44-2f4bfd01d165";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: colErr } = await supabase
    .from("cohort_lesson_log_entries")
    .select("status_source")
    .limit(1);
  if (colErr) {
    throw new Error(
      `Missing columns: ${colErr.message}. Apply supabase/cohort-lesson-log-manual-source.sql first.`
    );
  }

  const { createLessonLogInNotionAndSupabase, updateLessonLogManualFields, upsertLessonLogEntryFromNotion, parseNotionLessonLogPage } =
    await import("../src/lib/notion/lesson-log-sync.ts");
  const { notionJson } = await import("../src/lib/notion/client.ts");

  const { data: tutor } = await supabase
    .from("cohorts")
    .select("tutor_id")
    .eq("id", COHORT_38)
    .maybeSingle();

  console.log("1) Create app lesson for Cohort 38…");
  const created = await createLessonLogInNotionAndSupabase(supabase, {
    cohortId: COHORT_38,
    lessonDate: new Date().toISOString().slice(0, 10),
    notes: "Two-way verify note (app create)",
    status: "Completed",
    loggedBy: tutor?.tutor_id ?? null,
  });
  if (!created.ok) throw new Error(created.error);
  console.log("created", created);

  const { data: row } = await supabase
    .from("cohort_lesson_log_entries")
    .select("*")
    .eq("id", created.entryId)
    .single();
  console.log("row", {
    source: row?.source,
    status: row?.status,
    status_source: row?.status_source,
    cohort_id: row?.cohort_id,
    notion_page_id: row?.notion_page_id,
  });

  const notionPage = await notionJson<{
    id: string;
    properties: Record<string, unknown>;
  }>(`/pages/${created.notionPageId}`);
  const rel = (notionPage.properties["New Package DB"] as { relation?: Array<{ id: string }> })
    ?.relation;
  console.log("Notion New Package DB relation", rel);

  console.log("2) Manual status override → Cancelled…");
  const updated = await updateLessonLogManualFields(supabase, created.entryId, {
    status: "Cancelled",
  });
  if (!updated.ok) throw new Error(updated.error);

  console.log("3) Re-pull that Notion page and confirm status stays Cancelled…");
  const parsed = parseNotionLessonLogPage(
    await notionJson(`/pages/${created.notionPageId}`)
  );
  await upsertLessonLogEntryFromNotion(supabase, parsed);

  const { data: after } = await supabase
    .from("cohort_lesson_log_entries")
    .select("status, status_source, source, notes")
    .eq("id", created.entryId)
    .single();
  console.log("after pull", after);

  if (after?.status !== "Cancelled" || after?.status_source !== "manual") {
    throw new Error("FAIL: manual status was overwritten by pull");
  }
  if (after?.source !== "app") {
    throw new Error("FAIL: source=app was rewritten to notion");
  }

  console.log("PASS: create + manual override preserved across pull");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
