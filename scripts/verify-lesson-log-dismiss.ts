/**
 * Verify lesson-log dismiss columns + attention counts.
 *   node --env-file=.env.local --import tsx scripts/verify-lesson-log-dismiss.ts
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

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: colErr } = await supabase
    .from("cohort_lesson_log_entries")
    .select("dismissed_at, dismissed_by")
    .limit(1);
  if (colErr) {
    throw new Error(
      `Missing columns: ${colErr.message}. Apply supabase/cohort-lesson-log-dismiss.sql first.`
    );
  }

  const { loadAdminLessonLogSnapshot } = await import(
    "../src/lib/admin/load-admin-lesson-log.ts"
  );

  const before = await loadAdminLessonLogSnapshot(supabase);
  console.log("before totals", before.totals);

  const { data: openUnlinked } = await supabase
    .from("cohort_lesson_log_entries")
    .select("id, lesson_title, lesson_date, dismissed_at")
    .is("cohort_id", null)
    .is("package_instance_id", null)
    .is("dismissed_at", null)
    .order("lesson_date", { ascending: true })
    .limit(1);

  const target = openUnlinked?.[0];
  if (!target) {
    console.log("No open unlinked entries to dismiss — count already clear.");
    return;
  }

  console.log("dismissing", target);
  const { error } = await supabase
    .from("cohort_lesson_log_entries")
    .update({
      dismissed_at: new Date().toISOString(),
      dismissed_by: null,
    })
    .eq("id", target.id);
  if (error) throw new Error(error.message);

  const after = await loadAdminLessonLogSnapshot(supabase);
  console.log("after totals", after.totals);

  if (after.totals.unlinked !== before.totals.unlinked - 1) {
    throw new Error(
      `Expected unlinked ${before.totals.unlinked - 1}, got ${after.totals.unlinked}`
    );
  }

  // Simulate a NEW unlinked entry (not dismissed) still counts.
  const { data: inserted, error: insertError } = await supabase
    .from("cohort_lesson_log_entries")
    .insert({
      notion_page_id: `verify-dismiss-${Date.now()}`,
      cohort_id: null,
      package_instance_id: null,
      lesson_title: "Verify dismiss — synthetic unlinked",
      lesson_date: new Date().toISOString().slice(0, 10),
      source: "app",
      status: "Completed",
      reviewed: false,
      notion_sync_status: "error",
      notion_sync_error: "synthetic verify row",
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? "insert failed");
  }

  const withNew = await loadAdminLessonLogSnapshot(supabase);
  console.log("with synthetic unlinked", withNew.totals);
  if (withNew.totals.unlinked < after.totals.unlinked + 1) {
    throw new Error("New unlinked entry was not counted — dismiss logic too broad.");
  }

  await supabase.from("cohort_lesson_log_entries").delete().eq("id", inserted.id);
  console.log("PASS: dismiss drops unlinked count; new unlinked still appears");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
