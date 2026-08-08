/**
 * Generate Punjabi + English TTS for Life in the UK `lesson_sentences`.
 *
 * 44 sentences × 2 languages = 88 clips.
 *
 * Usage:
 *   npx tsx scripts/generate-lesson-sentence-audio.ts --dry-run
 *   npx tsx scripts/generate-lesson-sentence-audio.ts
 *   npx tsx scripts/generate-lesson-sentence-audio.ts --lang=pa
 *   npx tsx scripts/generate-lesson-sentence-audio.ts --lang=en --force
 *   npx tsx scripts/generate-lesson-sentence-audio.ts --pause-ms=600
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELEVENLABS_API_KEY
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ENGLISH_LESSON_VOICE_ID,
  PUNJABI_LESSON_VOICE_ID,
} from "../src/lib/elevenlabs/constants";
import { getPronunciationDictionaryLocator } from "../src/lib/elevenlabs/pronunciation-dictionary";
import { synthesizeSpeech } from "../src/lib/elevenlabs/server";

const AUDIO_BUCKET = "lesson-sentence-audio";
const LIFE_UK_NAME = "Life in the UK";

type SentenceRow = {
  id: string;
  lesson_id: string;
  sort_order: number;
  punjabi_text: string;
  english_text: string;
  punjabi_audio_url: string | null;
  english_audio_url: string | null;
  punjabi_audio_status: string | null;
  english_audio_status: string | null;
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

  const dryRun = hasFlag("dry-run");
  const force = hasFlag("force");
  const langArg = (argValue("lang") ?? "both").toLowerCase();
  const doPa = langArg === "both" || langArg === "pa" || langArg === "punjabi";
  const doEn = langArg === "both" || langArg === "en" || langArg === "english";
  const pauseMs = Number(argValue("pause-ms") ?? "700");

  if (!doPa && !doEn) {
    throw new Error("Use --lang=pa|en|both");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  if (!dryRun && !process.env.ELEVENLABS_API_KEY) {
    throw new Error("Missing ELEVENLABS_API_KEY");
  }

  const supabase = createClient(url, key);
  await ensureBucket(supabase, AUDIO_BUCKET);

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, name")
    .eq("content_track", "learn_english")
    .ilike("name", "%Life in the UK%")
    .maybeSingle();

  if (courseError || !course) {
    throw new Error(courseError?.message ?? `Course not found: ${LIFE_UK_NAME}`);
  }

  const { data: lessons, error: lessonError } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", course.id);

  if (lessonError) throw new Error(lessonError.message);
  const lessonIds = (lessons ?? []).map((row) => row.id as string);
  if (lessonIds.length === 0) throw new Error("No lessons on Life in the UK");

  const { data: sentences, error: sentenceError } = await supabase
    .from("lesson_sentences")
    .select(
      "id, lesson_id, sort_order, punjabi_text, english_text, punjabi_audio_url, english_audio_url, punjabi_audio_status, english_audio_status"
    )
    .in("lesson_id", lessonIds)
    .order("sort_order", { ascending: true });

  if (sentenceError) throw new Error(sentenceError.message);

  const rows = (sentences ?? []) as SentenceRow[];
  console.log(
    `Course: ${course.name} (${course.id})\nSentences: ${rows.length}\nLang: ${langArg} force=${force} dryRun=${dryRun}`
  );

  const pronunciation = doPa
    ? await getPronunciationDictionaryLocator(supabase).catch(() => null)
    : null;

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const jobs: Array<{
      lang: "pa" | "en";
      text: string;
      voiceId: string;
      statusCol: "punjabi_audio_status" | "english_audio_status";
      urlCol: "punjabi_audio_url" | "english_audio_url";
      currentStatus: string;
      currentUrl: string | null;
    }> = [];

    if (doPa) {
      jobs.push({
        lang: "pa",
        text: row.punjabi_text?.trim() ?? "",
        voiceId: PUNJABI_LESSON_VOICE_ID,
        statusCol: "punjabi_audio_status",
        urlCol: "punjabi_audio_url",
        currentStatus: row.punjabi_audio_status ?? "none",
        currentUrl: row.punjabi_audio_url,
      });
    }
    if (doEn) {
      jobs.push({
        lang: "en",
        text: row.english_text?.trim() ?? "",
        voiceId: ENGLISH_LESSON_VOICE_ID,
        statusCol: "english_audio_status",
        urlCol: "english_audio_url",
        currentStatus: row.english_audio_status ?? "none",
        currentUrl: row.english_audio_url,
      });
    }

    for (const job of jobs) {
      const alreadyDone =
        !force &&
        job.currentStatus === "approved" &&
        Boolean(job.currentUrl?.trim());
      if (alreadyDone) {
        skipped += 1;
        continue;
      }
      if (!job.text) {
        console.warn(`Skip empty text ${row.id} ${job.lang}`);
        skipped += 1;
        continue;
      }

      const storagePath = `${row.lesson_id}/${String(row.sort_order).padStart(2, "0")}-${row.id}-${job.lang}.mp3`;
      console.log(
        `${dryRun ? "[dry-run] " : ""}TTS ${job.lang} sort=${row.sort_order} ${job.text.slice(0, 48)}…`
      );

      if (dryRun) {
        generated += 1;
        continue;
      }

      await supabase
        .from("lesson_sentences")
        .update({ [job.statusCol]: "pending_review" })
        .eq("id", row.id);

      try {
        const { audio } = await synthesizeSpeech({
          text: job.text,
          voiceId: job.voiceId,
          pronunciationDictionaryLocators:
            job.lang === "pa" && pronunciation
              ? [pronunciation]
              : undefined,
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
          .from("lesson_sentences")
          .update({
            [job.urlCol]: publicUrl,
            [job.statusCol]: "approved",
          })
          .eq("id", row.id);
        if (updateError) throw new Error(updateError.message);

        generated += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`FAILED ${row.id} ${job.lang}: ${message}`);
        await supabase
          .from("lesson_sentences")
          .update({ [job.statusCol]: "needs_changes" })
          .eq("id", row.id);
      }

      if (pauseMs > 0) await sleep(pauseMs);
    }
  }

  console.log(
    `\nDone. generated=${generated} skipped=${skipped} failed=${failed}`
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
