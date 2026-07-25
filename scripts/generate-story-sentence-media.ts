/**
 * Generate per-sentence images (Gemini) + audio (ElevenLabs) for kid bedtime stories.
 *
 * TEST BATCH (default): Story display_order=1 only — stop for Gurupma review.
 *
 * Usage:
 *   npx tsx scripts/generate-story-sentence-media.ts --dry-run
 *   npx tsx scripts/generate-story-sentence-media.ts --story-order=1
 *   npx tsx scripts/generate-story-sentence-media.ts --story-order=1 --audio-only
 *   npx tsx scripts/generate-story-sentence-media.ts --story-order=1 --images-only
 *   npx tsx scripts/generate-story-sentence-media.ts --story-order=1 --force
 *   npx tsx scripts/generate-story-sentence-media.ts --all   # ONLY after test approval
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   ELEVENLABS_API_KEY, GEMINI_API_KEY
 *
 * Prerequisites:
 *   Run supabase/story-sentence-media.sql in Supabase SQL Editor once.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { synthesizeSpeech } from "../src/lib/elevenlabs/server";
import { PUNJABI_LESSON_VOICE_ID } from "../src/lib/elevenlabs/constants";
import { getPronunciationDictionaryLocator } from "../src/lib/elevenlabs/pronunciation-dictionary";
import {
  GEMINI_FLASH_IMAGE_USD_PER_IMAGE,
  generateStorySceneImage,
  type StoryImageReference,
} from "../src/lib/kids/story-scene-image";

const IMAGE_BUCKET = "story-scene-images";
const AUDIO_BUCKET = "story-sentence-audio";
const VOICE_ID = PUNJABI_LESSON_VOICE_ID;

/** ElevenLabs Creative platform approx for multilingual / v3 — report as estimate. */
const ELEVENLABS_USD_PER_1K_CHARS = 0.18;

type StoryRow = {
  id: string;
  title: string;
  display_order: number;
  is_premium: boolean;
};

type SentenceRow = {
  id: string;
  story_id: string;
  sentence_order: number;
  text_gurmukhi: string;
  text_romanised: string | null;
  text_english: string;
  image_url: string | null;
  audio_url: string | null;
  audio_duration_ms: number | null;
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

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function publicObjectUrl(supabaseUrl: string, bucket: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path}`;
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  return "png";
}

/** Rough MP3 duration from byte length at 128 kbps (ElevenLabs default). */
function estimateMp3DurationMs(byteLength: number): number {
  const bits = byteLength * 8;
  const seconds = bits / 128_000;
  return Math.max(500, Math.round(seconds * 1000));
}

function characterBibleForStory(title: string): string {
  if (/lion.*mouse|mouse.*lion/i.test(title)) {
    return [
      "Lion: large soft golden-orange mane, warm amber eyes, gentle smile when kind, rounded paws, friendly not scary.",
      "Mouse: tiny grey-brown body, big round ears, bright curious eyes, pink nose, same size relative to the lion in every scene.",
    ].join(" ");
  }
  return `Keep every recurring character from "${title}" visually identical across scenes (colours, proportions, clothing if any).`;
}

async function ensureBucket(
  supabase: SupabaseClient,
  id: string,
  mimeTypes: string[]
): Promise<void> {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`listBuckets failed: ${error.message}`);
  if ((buckets ?? []).some((b) => b.id === id || b.name === id)) return;
  const { error: createError } = await supabase.storage.createBucket(id, {
    public: true,
    fileSizeLimit: 52_428_800,
    allowedMimeTypes: mimeTypes,
  });
  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new Error(`createBucket ${id}: ${createError.message}`);
  }
}

async function main() {
  loadEnvLocal();

  const dryRun = hasFlag("dry-run");
  const force = hasFlag("force");
  const audioOnly = hasFlag("audio-only");
  const imagesOnly = hasFlag("images-only");
  const runAll = hasFlag("all");
  const pauseMs = Number(argValue("pause-ms") ?? "800");
  const storyOrder = Number(argValue("story-order") ?? "1");

  if (runAll) {
    console.error(
      "Refusing --all until Story 1 test batch is approved. Remove this guard only after Gurupma confirms."
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");

  const supabase = createClient(url, key);

  // Probe optional audio columns (image_url already exists on story_sentences)
  const { error: colProbe } = await supabase
    .from("story_sentences")
    .select("id, audio_url, audio_duration_ms")
    .limit(1);
  const audioColumnsReady = !colProbe?.message?.includes("audio_url");
  if (!audioColumnsReady) {
    console.warn(
      "WARNING: audio_url / audio_duration_ms missing. Run supabase/story-sentence-media.sql.\n" +
        "Will still upload audio to storage and write URLs into the report JSON for review."
    );
  }

  await ensureBucket(supabase, IMAGE_BUCKET, ["image/png", "image/jpeg", "image/webp"]);
  await ensureBucket(supabase, AUDIO_BUCKET, ["audio/mpeg", "audio/mp3", "audio/wav"]);

  const { data: story, error: storyError } = await supabase
    .from("kid_bedtime_stories")
    .select("id, title, display_order, is_premium")
    .eq("display_order", storyOrder)
    .maybeSingle();

  if (storyError || !story) {
    throw new Error(storyError?.message ?? `No story with display_order=${storyOrder}`);
  }

  const storyRow = story as StoryRow;
  const { data: sentences, error: sentenceError } = await supabase
    .from("story_sentences")
    .select(
      "id, story_id, sentence_order, text_gurmukhi, text_romanised, text_english, image_url"
    )
    .eq("story_id", storyRow.id)
    .order("sentence_order", { ascending: true });

  if (sentenceError) throw new Error(sentenceError.message);

  // Merge audio columns when present
  let rows = (sentences ?? []).map((row) => ({
    ...(row as Omit<SentenceRow, "audio_url" | "audio_duration_ms">),
    audio_url: null as string | null,
    audio_duration_ms: null as number | null,
  }));

  if (audioColumnsReady) {
    const { data: withAudio, error: audioSelectError } = await supabase
      .from("story_sentences")
      .select("id, audio_url, audio_duration_ms")
      .eq("story_id", storyRow.id);
    if (audioSelectError) throw new Error(audioSelectError.message);
    const map = new Map(
      (withAudio ?? []).map((row) => [
        row.id as string,
        {
          audio_url: (row.audio_url as string | null) ?? null,
          audio_duration_ms: (row.audio_duration_ms as number | null) ?? null,
        },
      ])
    );
    rows = rows.map((row) => ({
      ...row,
      audio_url: map.get(row.id)?.audio_url ?? null,
      audio_duration_ms: map.get(row.id)?.audio_duration_ms ?? null,
    }));
  }

  if (rows.length === 0) throw new Error(`No story_sentences for ${storyRow.title}`);

  console.log(
    `Story ${storyRow.display_order}: ${storyRow.title} (${rows.length} sentences)${dryRun ? " [dry-run]" : ""}`
  );

  const pronunciation = await getPronunciationDictionaryLocator(supabase);
  const locators = pronunciation ? [pronunciation] : undefined;
  const bible = characterBibleForStory(storyRow.title);

  let imagesGenerated = 0;
  let audioGenerated = 0;
  let audioChars = 0;
  let imageFailures = 0;
  let audioFailures = 0;
  let firstSceneRef: StoryImageReference | null = null;

  const reportDir = resolve(process.cwd(), "tmp/story-sentence-media");
  mkdirSync(reportDir, { recursive: true });
  const reportItems: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const item: Record<string, unknown> = {
      sentenceId: row.id,
      sentence_order: row.sentence_order,
      english: row.text_english,
      gurmukhi: row.text_gurmukhi,
    };

    const doImage = imagesOnly || !audioOnly;
    const doAudio = audioOnly || !imagesOnly;

    if (doImage) {
      if (row.image_url && !force) {
        item.image_url = row.image_url;
        item.image = "skipped_existing";
        // Seed reference from existing if we can fetch it later — skip for now
      } else if (dryRun) {
        item.image = "dry-run";
        imagesGenerated++;
      } else {
        try {
          const refs = firstSceneRef ? [firstSceneRef] : [];
          const generated = await generateStorySceneImage({
            sceneEnglish: row.text_english,
            storyTitle: storyRow.title,
            characterBible: bible,
            references: refs,
          });
          const path = `${storyRow.id}/${row.sentence_order}.png`;
          const { error: uploadError } = await supabase.storage
            .from(IMAGE_BUCKET)
            .upload(path, generated.bytes, {
              contentType: generated.mimeType.includes("jpeg")
                ? "image/jpeg"
                : generated.mimeType.includes("webp")
                  ? "image/webp"
                  : "image/png",
              upsert: true,
            });
          if (uploadError) throw new Error(uploadError.message);
          const imageUrl = publicObjectUrl(url, IMAGE_BUCKET, path);
          const { error: updateError } = await supabase
            .from("story_sentences")
            .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
            .eq("id", row.id);
          if (updateError) throw new Error(updateError.message);

          if (!firstSceneRef) {
            firstSceneRef = {
              mimeType: generated.mimeType,
              base64: generated.bytes.toString("base64"),
            };
          }

          item.image_url = imageUrl;
          item.image_model = generated.model;
          item.image = "generated";
          imagesGenerated++;
          console.log(`  img ok  #${row.sentence_order} (${generated.model})`);
        } catch (error) {
          imageFailures++;
          item.image = "failed";
          item.image_error = error instanceof Error ? error.message : String(error);
          console.error(`  img FAIL #${row.sentence_order}: ${item.image_error}`);
        }
        if (pauseMs > 0) await sleep(pauseMs);
      }
    }

    if (doAudio) {
      if (row.audio_url && !force) {
        item.audio_url = row.audio_url;
        item.audio_duration_ms = row.audio_duration_ms;
        item.audio = "skipped_existing";
      } else if (dryRun) {
        const chars = row.text_gurmukhi.trim().length;
        audioChars += chars;
        audioGenerated++;
        item.audio = "dry-run";
        item.chars = chars;
      } else {
        try {
          const script = row.text_gurmukhi.trim();
          if (!script) throw new Error("Empty text_gurmukhi");
          const synth = await synthesizeSpeech({
            text: script,
            voiceId: VOICE_ID,
            pronunciationDictionaryLocators: locators,
          });
          const audioBytes = Buffer.from(synth.audio);
          const durationMs = estimateMp3DurationMs(audioBytes.byteLength);
          const path = `${storyRow.id}/${String(row.sentence_order).padStart(2, "0")}-${row.id}.mp3`;
          const { error: uploadError } = await supabase.storage
            .from(AUDIO_BUCKET)
            .upload(path, audioBytes, {
              contentType: "audio/mpeg",
              upsert: true,
            });
          if (uploadError) throw new Error(uploadError.message);
          const audioUrl = publicObjectUrl(url, AUDIO_BUCKET, path);
          if (audioColumnsReady) {
            const { error: updateError } = await supabase
              .from("story_sentences")
              .update({
                audio_url: audioUrl,
                audio_duration_ms: durationMs,
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.id);
            if (updateError) throw new Error(updateError.message);
          } else {
            item.audio_db = "deferred_until_sql_migration";
          }

          audioChars += synth.normalizedText.length;
          audioGenerated++;
          item.audio_url = audioUrl;
          item.audio_duration_ms = durationMs;
          item.chars = synth.normalizedText.length;
          item.audio = "generated";
          console.log(`  aud ok  #${row.sentence_order} (${synth.normalizedText.length} chars, ~${durationMs}ms)`);
        } catch (error) {
          audioFailures++;
          item.audio = "failed";
          item.audio_error = error instanceof Error ? error.message : String(error);
          console.error(`  aud FAIL #${row.sentence_order}: ${item.audio_error}`);
        }
        if (pauseMs > 0) await sleep(pauseMs);
      }
    }

    reportItems.push(item);
  }

  const geminiUsd = imagesGenerated * GEMINI_FLASH_IMAGE_USD_PER_IMAGE;
  const elevenUsd = (audioChars / 1000) * ELEVENLABS_USD_PER_1K_CHARS;
  const summary = {
    storyId: storyRow.id,
    title: storyRow.title,
    displayOrder: storyRow.display_order,
    sentenceCount: rows.length,
    imagesGenerated,
    imageFailures,
    audioGenerated,
    audioFailures,
    elevenLabsCharacters: audioChars,
    estimatedCostUsd: {
      geminiImages: Number(geminiUsd.toFixed(4)),
      elevenLabsAudio: Number(elevenUsd.toFixed(4)),
      total: Number((geminiUsd + elevenUsd).toFixed(4)),
      notes: [
        `Gemini Flash Image ~$${GEMINI_FLASH_IMAGE_USD_PER_IMAGE}/image (paid tier)`,
        `ElevenLabs ~$${ELEVENLABS_USD_PER_1K_CHARS}/1k chars (estimate; check your plan)`,
      ],
    },
    items: reportItems,
  };

  const reportPath = resolve(reportDir, `story-${storyRow.display_order}-report.json`);
  writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log("\nSummary:", JSON.stringify(summary.estimatedCostUsd, null, 2));
  console.log(`Report: ${reportPath}`);
  console.log(
    "\nSTOP — Story 1 test batch only. Do not run remaining stories until Gurupma approves."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
