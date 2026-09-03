/**
 * Generate Punjabi TTS for Foundational Course letter/matra names (FC-Q1, FC-Q2,
 * FC-Q3 #10–11) from Gurmukhi script — not Latin transliteration.
 *
 * Usage:
 *   npx tsx scripts/generate-foundational-quiz-audio.ts --dry-run
 *   npx tsx scripts/generate-foundational-quiz-audio.ts
 *   npx tsx scripts/generate-foundational-quiz-audio.ts --force
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
/** New object key so CDN/browser cache cannot keep serving romanized clips. */
const STORAGE_SUFFIX = "pa-gurmukhi.mp3";
const LEGACY_SUFFIX = "pa.mp3";

type QuizClip = {
  title: string;
  questionOrder: number;
  ttsText: string;
};

/** Letter / matra names that were previously synthesized from Latin transliteration. */
const CLIPS: QuizClip[] = [
  { title: "FC - Q1", questionOrder: 1, ttsText: "ਊੜਾ" },
  { title: "FC - Q1", questionOrder: 2, ttsText: "ਐੜਾ" },
  { title: "FC - Q1", questionOrder: 3, ttsText: "ਈੜੀ" },
  { title: "FC - Q1", questionOrder: 4, ttsText: "ਸੱਸਾ" },
  { title: "FC - Q1", questionOrder: 5, ttsText: "ਹਾਹਾ" },
  { title: "FC - Q1", questionOrder: 6, ttsText: "ਕੱਕਾ" },
  { title: "FC - Q1", questionOrder: 7, ttsText: "ਖੱਖਾ" },
  { title: "FC - Q1", questionOrder: 8, ttsText: "ਗੱਗਾ" },
  { title: "FC - Q1", questionOrder: 9, ttsText: "ਘੱਘਾ" },
  { title: "FC - Q1", questionOrder: 10, ttsText: "ਙੰਙਾ" },
  { title: "FC - Q1", questionOrder: 11, ttsText: "ਚੱਚਾ" },
  { title: "FC - Q1", questionOrder: 12, ttsText: "ਛੱਛਾ" },
  { title: "FC - Q1", questionOrder: 13, ttsText: "ਜੱਜਾ" },
  { title: "FC - Q1", questionOrder: 14, ttsText: "ਝੱਝਾ" },
  { title: "FC - Q1", questionOrder: 15, ttsText: "ਞੰਞਾ" },
  { title: "FC - Q2", questionOrder: 1, ttsText: "ਟੈਂਕਾ" },
  { title: "FC - Q2", questionOrder: 2, ttsText: "ਠੱਠਾ" },
  { title: "FC - Q2", questionOrder: 3, ttsText: "ਡੱਡਾ" },
  { title: "FC - Q2", questionOrder: 4, ttsText: "ਢੱਢਾ" },
  { title: "FC - Q2", questionOrder: 5, ttsText: "ਣਾਣਾ" },
  { title: "FC - Q2", questionOrder: 6, ttsText: "ਤੱਤਾ" },
  { title: "FC - Q2", questionOrder: 7, ttsText: "ਥੱਥਾ" },
  { title: "FC - Q2", questionOrder: 8, ttsText: "ਦੱਦਾ" },
  { title: "FC - Q2", questionOrder: 9, ttsText: "ਧੱਧਾ" },
  { title: "FC - Q2", questionOrder: 10, ttsText: "ਨੰਨਾ" },
  { title: "FC - Q2", questionOrder: 11, ttsText: "ਪੱਪਾ" },
  { title: "FC - Q2", questionOrder: 12, ttsText: "ਫੱਫਾ" },
  { title: "FC - Q2", questionOrder: 13, ttsText: "ਬੱਬਾ" },
  { title: "FC - Q2", questionOrder: 14, ttsText: "ਭੱਭਾ" },
  { title: "FC - Q2", questionOrder: 15, ttsText: "ਮੱਮਾ" },
  { title: "FC - Q2", questionOrder: 16, ttsText: "ਯੱਯਾ" },
  { title: "FC - Q2", questionOrder: 17, ttsText: "ਰਾਰਾ" },
  { title: "FC - Q2", questionOrder: 18, ttsText: "ਲੱਲਾ" },
  { title: "FC - Q2", questionOrder: 19, ttsText: "ਵਾਵਾ" },
  { title: "FC - Q2", questionOrder: 20, ttsText: "ੜਾੜਾ" },
  { title: "FC - Q3", questionOrder: 10, ttsText: "ਬਿਹਾਰੀ" },
  { title: "FC - Q3", questionOrder: 11, ttsText: "ਦੁਲਾਂਵ" },
];

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

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit?.slice(prefix.length);
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
  const pauseMs = Number(argValue("pause-ms") ?? "800");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  if (!dryRun && !process.env.ELEVENLABS_API_KEY) {
    throw new Error("Missing ELEVENLABS_API_KEY");
  }

  const supabase = createClient(url, key);
  await ensureBucket(supabase, AUDIO_BUCKET);

  const titles = [...new Set(CLIPS.map((clip) => clip.title))];
  const { data: quizzes, error: quizError } = await supabase
    .from("quizzes")
    .select("id, title")
    .in("title", titles);
  if (quizError) throw new Error(quizError.message);

  const quizIdByTitle = new Map(
    (quizzes ?? []).map((quiz) => [quiz.title as string, quiz.id as string])
  );
  for (const title of titles) {
    if (!quizIdByTitle.has(title)) {
      throw new Error(`Quiz not found: ${title}`);
    }
  }

  const pronunciation = dryRun
    ? null
    : await getPronunciationDictionaryLocator(supabase).catch(() => null);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const clip of CLIPS) {
    const quizId = quizIdByTitle.get(clip.title)!;
    const { data: row, error: rowError } = await supabase
      .from("quiz_questions")
      .select("id, quiz_id, question_audio_pa_url, question_audio_pa_status")
      .eq("quiz_id", quizId)
      .eq("question_order", clip.questionOrder)
      .maybeSingle();
    if (rowError) throw new Error(rowError.message);
    if (!row) {
      failed += 1;
      console.error(`MISSING ${clip.title} #${clip.questionOrder}`);
      continue;
    }

    const alreadyGurmukhi =
      !force && Boolean(row.question_audio_pa_url?.includes(STORAGE_SUFFIX));
    if (alreadyGurmukhi) {
      skipped += 1;
      console.log(`SKIP ${clip.title} #${clip.questionOrder} already ${STORAGE_SUFFIX}`);
      continue;
    }

    const storagePath = `${quizId}/${row.id}-${STORAGE_SUFFIX}`;
    const legacyPath = `${quizId}/${row.id}-${LEGACY_SUFFIX}`;
    console.log(
      `${dryRun ? "[dry-run] " : ""}TTS ${clip.title} #${clip.questionOrder} “${clip.ttsText}” → ${storagePath}`
    );

    if (dryRun) {
      generated += 1;
      continue;
    }

    await supabase
      .from("quiz_questions")
      .update({ question_audio_pa_status: "pending_review" })
      .eq("id", row.id);

    try {
      const { audio } = await synthesizeSpeech({
        text: clip.ttsText,
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
        .from("quiz_questions")
        .update({
          question_audio_pa_url: publicUrl,
          question_audio_pa_status: "approved",
        })
        .eq("id", row.id);
      if (updateError) throw new Error(updateError.message);

      if (row.question_audio_pa_url && row.question_audio_pa_url !== publicUrl) {
        await supabase.storage.from(AUDIO_BUCKET).remove([legacyPath]);
      }

      generated += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`FAILED ${clip.title} #${clip.questionOrder}: ${message}`);
      await supabase
        .from("quiz_questions")
        .update({ question_audio_pa_status: "needs_changes" })
        .eq("id", row.id);
    }

    if (pauseMs > 0) await sleep(pauseMs);
  }

  console.log(`\nDone. generated=${generated} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
