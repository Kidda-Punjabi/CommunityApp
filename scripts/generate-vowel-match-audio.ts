/**
 * Generate Punjabi TTS for Vowel Match words from Gurmukhi script.
 *
 * Usage:
 *   npx tsx scripts/generate-vowel-match-audio.ts --dry-run
 *   npx tsx scripts/generate-vowel-match-audio.ts
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELEVENLABS_API_KEY
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PUNJABI_LESSON_VOICE_ID } from "../src/lib/elevenlabs/constants";
import { getPronunciationDictionaryLocator } from "../src/lib/elevenlabs/pronunciation-dictionary";
import { synthesizeSpeech } from "../src/lib/elevenlabs/server";

const AUDIO_BUCKET = "quiz-question-audio";
const EXPECTED_VOICE_ID = "ttyKbP9zTIRyRCN6b2Ye";

/** Spoken form when the stored Gurmukhi spelling makes TTS misread the word. */
const TTS_OVERRIDES: Record<string, string> = {
  ਮੇਜ: "ਮੇਜ਼",
};

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
    if (!process.env[key]) process.env[key] = value;
  }
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function publicObjectUrl(supabaseUrl: string, bucket: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

async function ensureBucket(supabase: SupabaseClient, id: string): Promise<void> {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`listBuckets failed: ${error.message}`);
  if ((buckets ?? []).some((b) => b.id === id || b.name === id)) return;
  const { error: createError } = await supabase.storage.createBucket(id, {
    public: true,
    fileSizeLimit: 10_485_760,
    allowedMimeTypes: ["audio/mpeg", "audio/mp3"],
  });
  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new Error(`createBucket ${id}: ${createError.message}`);
  }
}

async function main() {
  loadEnvLocal();

  if (PUNJABI_LESSON_VOICE_ID !== EXPECTED_VOICE_ID) {
    throw new Error(
      `Punjabi voice mismatch: expected ${EXPECTED_VOICE_ID}, got ${PUNJABI_LESSON_VOICE_ID}`
    );
  }

  const dryRun = hasFlag("dry-run");
  const force = hasFlag("force");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  if (!dryRun && !process.env.ELEVENLABS_API_KEY) {
    throw new Error("Missing ELEVENLABS_API_KEY");
  }

  const supabase = createClient(url, key);
  await ensureBucket(supabase, AUDIO_BUCKET);

  const { data: rows, error } = await supabase
    .from("vowel_game_words")
    .select("id, word_gurmukhi, audio_pa_url")
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  if (!rows?.length) throw new Error("No vowel_game_words rows found");

  const pronunciation = dryRun
    ? null
    : await getPronunciationDictionaryLocator(supabase).catch(() => null);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const alreadyDone = !force && Boolean(row.audio_pa_url?.trim());
    if (alreadyDone) {
      skipped += 1;
      console.log(`SKIP ${row.word_gurmukhi}`);
      continue;
    }

    const storagePath = `vowel-match/${row.id}-pa.mp3`;
    console.log(
      `${dryRun ? "[dry-run] " : ""}TTS “${row.word_gurmukhi}” → ${storagePath}`
    );

    if (dryRun) {
      generated += 1;
      continue;
    }

    try {
      const { audio } = await synthesizeSpeech({
        text: TTS_OVERRIDES[row.word_gurmukhi] ?? row.word_gurmukhi,
        voiceId: PUNJABI_LESSON_VOICE_ID,
        pronunciationDictionaryLocators: pronunciation ? [pronunciation] : undefined,
      });

      const bytes = Buffer.from(audio);
      const { error: uploadError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .upload(storagePath, bytes, {
          contentType: "audio/mpeg",
          upsert: true,
        });
      if (uploadError) throw new Error(uploadError.message);

      const publicUrl = publicObjectUrl(url, AUDIO_BUCKET, storagePath);
      const { error: updateError } = await supabase
        .from("vowel_game_words")
        .update({ audio_pa_url: publicUrl })
        .eq("id", row.id);
      if (updateError) throw new Error(updateError.message);

      generated += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`FAILED ${row.word_gurmukhi}: ${message}`);
    }

    await sleep(600);
  }

  console.log(`\nDone. generated=${generated} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
