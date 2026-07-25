/**
 * After running supabase/story-sentence-media.sql, backfill audio_url /
 * audio_duration_ms for Story 1 from tmp/story-sentence-media/story-1-report.json
 *
 *   npx tsx scripts/backfill-story-sentence-audio-from-report.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const reportPath = resolve(process.cwd(), "tmp/story-sentence-media/story-1-report.json");
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
    items: Array<{
      sentenceId: string;
      audio_url?: string;
      audio_duration_ms?: number;
    }>;
  };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let updated = 0;
  for (const item of report.items) {
    if (!item.audio_url || !item.sentenceId) continue;
    const { error } = await supabase
      .from("story_sentences")
      .update({
        audio_url: item.audio_url,
        audio_duration_ms: item.audio_duration_ms ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.sentenceId);
    if (error) throw new Error(`${item.sentenceId}: ${error.message}`);
    updated++;
  }
  console.log(`Updated ${updated} sentences with audio_url.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
