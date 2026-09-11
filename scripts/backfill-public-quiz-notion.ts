/**
 * Sync public_quiz_attempts rows that have no Notion Test Scores page yet.
 *
 * Usage:
 *   npx tsx scripts/backfill-public-quiz-notion.ts --dry-run
 *   npx tsx scripts/backfill-public-quiz-notion.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  syncPublicQuizAttemptToNotion,
  type PublicQuizAttemptRow,
} from "../src/lib/public-forms/save-public-quiz-attempt";

function loadEnvFile(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const supabase = createClient(url, serviceKey);
  const { data: rows, error } = await supabase
    .from("public_quiz_attempts")
    .select("id, full_name, email, quiz_id, score, submitted_at")
    .is("notion_page_id", null)
    .order("submitted_at", { ascending: true });

  if (error) throw new Error(error.message);
  if (!rows?.length) {
    console.log("No public quiz attempts need Notion backfill.");
    return;
  }

  console.log(`Found ${rows.length} attempt(s) to sync${dryRun ? " (dry run)" : ""}.`);

  for (const row of rows as PublicQuizAttemptRow[]) {
    console.log(`\n• ${row.id} — ${row.full_name} score=${row.score}`);
    if (dryRun) continue;

    const result = await syncPublicQuizAttemptToNotion(supabase, row);
    if (result.notionSynced) {
      console.log("  Synced");
    } else {
      console.error(`  Failed: ${result.notionError}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
