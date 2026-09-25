/**
 * Backfill package-page Notion recording links into empty lesson log rows.
 *
 *   node --import tsx scripts/sync-package-lesson-recordings.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { syncPackageLessonRecordings } from "../src/lib/notion/package-lesson-recordings";

function loadEnvFile(filename: string) {
  const text = readFileSync(resolve(process.cwd(), filename), "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role is not configured.");
  if (!process.env.NOTION_API_KEY?.trim()) throw new Error("NOTION_API_KEY is not configured.");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const holder = randomUUID();
  const { data: acquired, error: lockError } = await supabase.rpc("try_acquire_notion_sync_lock", {
    p_name: "notion-sync",
    p_holder: holder,
    p_ttl_seconds: 1800,
  });
  if (lockError) throw new Error(lockError.message);
  if (acquired !== true) {
    throw new Error("Another Notion sync is running. Retry when it finishes.");
  }

  const startedAt = new Date().toISOString();
  try {
    const result = await syncPackageLessonRecordings(supabase);
    const finishedAt = new Date().toISOString();
    const steps = {
      packageLessonRecordings: {
        ok: result.errors.length === 0,
        errors: result.errors,
        packagesScanned: result.packagesScanned,
        rowsRead: result.rowsRead,
        linksFilled: result.linksFilled,
        unmatchedRows: result.unmatchedRows,
        skipped: result.skipped,
      },
    };
    const { error: insertError } = await supabase.from("notion_sync_runs").insert({
      started_at: startedAt,
      finished_at: finishedAt,
      duration_ms: Date.now() - new Date(startedAt).getTime(),
      outcome: result.errors.length === 0 ? "succeeded" : "failed",
      skipped_overlap: false,
      steps,
      error: result.errors[0] ?? null,
    });
    if (insertError) console.error("Could not log notion_sync_runs:", insertError.message);

    const byReason = new Map<string, number>();
    for (const skip of result.skipped) {
      byReason.set(skip.reason, (byReason.get(skip.reason) ?? 0) + 1);
    }

    console.log(
      JSON.stringify(
        {
          packagesScanned: result.packagesScanned,
          rowsRead: result.rowsRead,
          linksFilled: result.linksFilled,
          unmatchedRows: result.unmatchedRows,
          skippedCount: result.skipped.length,
          reasons: Object.fromEntries(byReason),
          errors: result.errors,
        },
        null,
        2
      )
    );
    console.log("SKIPPED");
    for (const skip of result.skipped) {
      console.log(`${skip.kind}\t${skip.name}\t${skip.reason}`);
    }
  } finally {
    const { error: releaseError } = await supabase.rpc("release_notion_sync_lock", {
      p_name: "notion-sync",
      p_holder: holder,
    });
    if (releaseError) console.error("Could not release sync lock:", releaseError.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
