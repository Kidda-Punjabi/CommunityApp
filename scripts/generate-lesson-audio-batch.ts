/**
 * Batch-generate lesson audio via ElevenLabs → Supabase (pending review only).
 *
 * Usage:
 *   npx tsx scripts/generate-lesson-audio-batch.ts
 *   npx tsx scripts/generate-lesson-audio-batch.ts --batch-size=5 --pause-ms=3000
 *   npx tsx scripts/generate-lesson-audio-batch.ts --lesson-id=<uuid> --force
 *
 * Requires in .env.local (loaded automatically if present):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELEVENLABS_API_KEY
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { generateContentAudio } from "../src/lib/audio/generate-audio";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;

  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit?.slice(prefix.length);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    console.error("Missing ELEVENLABS_API_KEY.");
    process.exit(1);
  }

  const batchSize = Math.max(1, parseInt(argValue("batch-size") ?? "5", 10));
  const pauseMs = Math.max(0, parseInt(argValue("pause-ms") ?? "2000", 10));
  const forceLessonId = argValue("lesson-id");
  const force = process.argv.includes("--force");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (forceLessonId) {
    console.log(`Generating single lesson ${forceLessonId} (force=${force})…`);
    const result = await generateContentAudio(supabase, "lesson", forceLessonId, { force });
    if (!result.ok) {
      console.error("Failed:", result.error);
      process.exit(1);
    }
    console.log("Done:", result.storagePath);
    return;
  }

  const { data: assets, error } = await supabase
    .from("audio_assets")
    .select("content_id")
    .eq("content_type", "lesson")
    .neq("status", "none");

  const lessonIdsWithAssets = new Set((assets ?? []).map((row) => row.content_id as string));

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, title")
    .order("lesson_number");

  if (error || lessonsError) {
    console.error("Failed to load lessons:", error?.message ?? lessonsError?.message);
    process.exit(1);
  }

  const queue = (lessons ?? []).filter((lesson) => !lessonIdsWithAssets.has(lesson.id));
  console.log(`Found ${queue.length} lesson(s) without an audio workflow started.`);

  if (queue.length === 0) {
    return;
  }

  let totalOk = 0;
  let totalFail = 0;
  let totalSkipped = 0;

  for (let i = 0; i < queue.length; i += batchSize) {
    const batch = queue.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    console.log(`\n--- Batch ${batchNum} (${batch.length} lesson(s)) ---`);

    for (const lesson of batch) {
      const label = `${lesson.id.slice(0, 8)}… ${lesson.title}`;
      const result = await generateContentAudio(supabase, "lesson", lesson.id, {
        batchMode: true,
      });

      if (!result.ok) {
        if (result.skipped) {
          totalSkipped += 1;
          console.log(`  SKIP  ${label}: ${result.error}`);
        } else {
          totalFail += 1;
          console.log(`  FAIL  ${label}: ${result.error}`);
        }
        continue;
      }

      totalOk += 1;
      console.log(`  OK    ${label} → ${result.storagePath}`);
    }

    if (i + batchSize < queue.length && pauseMs > 0) {
      console.log(`Pausing ${pauseMs}ms before next batch…`);
      await sleep(pauseMs);
    }
  }

  console.log(
    `\nSummary: ${totalOk} succeeded, ${totalFail} failed, ${totalSkipped} skipped.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
