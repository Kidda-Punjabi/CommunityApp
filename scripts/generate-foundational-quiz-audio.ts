/**
 * Generate Punjabi TTS for Foundational Course quiz prompts (FC-Q1 … FC-Q4)
 * and store URLs on quiz_questions.question_audio_pa_url.
 *
 * Usage:
 *   npx tsx scripts/generate-foundational-quiz-audio.ts --dry-run
 *   npx tsx scripts/generate-foundational-quiz-audio.ts
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

type QuizClip = {
  title: string;
  questionOrder: number;
  ttsText: string;
};

const CLIPS: QuizClip[] = [
  // FC - Q1 letter names
  { title: "FC - Q1", questionOrder: 1, ttsText: "Oora" },
  { title: "FC - Q1", questionOrder: 2, ttsText: "Airaa" },
  { title: "FC - Q1", questionOrder: 3, ttsText: "Eeree" },
  { title: "FC - Q1", questionOrder: 4, ttsText: "Sassa" },
  { title: "FC - Q1", questionOrder: 5, ttsText: "Hahaa" },
  { title: "FC - Q1", questionOrder: 6, ttsText: "Kakka" },
  { title: "FC - Q1", questionOrder: 7, ttsText: "Khakha" },
  { title: "FC - Q1", questionOrder: 8, ttsText: "Gagga" },
  { title: "FC - Q1", questionOrder: 9, ttsText: "Ghaggha" },
  { title: "FC - Q1", questionOrder: 10, ttsText: "Nganga" },
  { title: "FC - Q1", questionOrder: 11, ttsText: "Chachaa" },
  { title: "FC - Q1", questionOrder: 12, ttsText: "Chhachha" },
  { title: "FC - Q1", questionOrder: 13, ttsText: "Jajja" },
  { title: "FC - Q1", questionOrder: 14, ttsText: "Jhajha" },
  { title: "FC - Q1", questionOrder: 15, ttsText: "Nyanya" },
  // FC - Q2 letter names
  { title: "FC - Q2", questionOrder: 1, ttsText: "Tainka" },
  { title: "FC - Q2", questionOrder: 2, ttsText: "Thathaa" },
  { title: "FC - Q2", questionOrder: 3, ttsText: "Duddaa" },
  { title: "FC - Q2", questionOrder: 4, ttsText: "Dhuddaa" },
  { title: "FC - Q2", questionOrder: 5, ttsText: "Nannaa" },
  { title: "FC - Q2", questionOrder: 6, ttsText: "Tataa" },
  { title: "FC - Q2", questionOrder: 7, ttsText: "Thathhaa" },
  { title: "FC - Q2", questionOrder: 8, ttsText: "Dadaa" },
  { title: "FC - Q2", questionOrder: 9, ttsText: "Dhadhhaa" },
  { title: "FC - Q2", questionOrder: 10, ttsText: "Nannaa" },
  { title: "FC - Q2", questionOrder: 11, ttsText: "Pappaa" },
  { title: "FC - Q2", questionOrder: 12, ttsText: "Phapphaa" },
  { title: "FC - Q2", questionOrder: 13, ttsText: "Babbhaa" },
  { title: "FC - Q2", questionOrder: 14, ttsText: "Bhabbhaa" },
  { title: "FC - Q2", questionOrder: 15, ttsText: "Mammaa" },
  { title: "FC - Q2", questionOrder: 16, ttsText: "Yayyaa" },
  { title: "FC - Q2", questionOrder: 17, ttsText: "Raraa" },
  { title: "FC - Q2", questionOrder: 18, ttsText: "Lallaa" },
  { title: "FC - Q2", questionOrder: 19, ttsText: "Vavaa" },
  { title: "FC - Q2", questionOrder: 20, ttsText: "Rarrhaa" },
  // FC - Q3 syllables / matra sounds (12 is conceptual — skip)
  { title: "FC - Q3", questionOrder: 1, ttsText: "ਕਾ" },
  { title: "FC - Q3", questionOrder: 2, ttsText: "ਕਿ" },
  { title: "FC - Q3", questionOrder: 3, ttsText: "ਕੀ" },
  { title: "FC - Q3", questionOrder: 4, ttsText: "ਕੁ" },
  { title: "FC - Q3", questionOrder: 5, ttsText: "ਕੂ" },
  { title: "FC - Q3", questionOrder: 6, ttsText: "ਕੇ" },
  { title: "FC - Q3", questionOrder: 7, ttsText: "ਕੈ" },
  { title: "FC - Q3", questionOrder: 8, ttsText: "ਕੋ" },
  { title: "FC - Q3", questionOrder: 9, ttsText: "ਕੌ" },
  { title: "FC - Q3", questionOrder: 10, ttsText: "ਈ" },
  { title: "FC - Q3", questionOrder: 11, ttsText: "ਐ" },
  // FC - Q4 words / numbers (15 is conceptual — skip)
  { title: "FC - Q4", questionOrder: 1, ttsText: "ਘਰ" },
  { title: "FC - Q4", questionOrder: 2, ttsText: "ਪਾਣੀ" },
  { title: "FC - Q4", questionOrder: 3, ttsText: "ਕਿਤਾਬ" },
  { title: "FC - Q4", questionOrder: 4, ttsText: "ਰੋਟੀ" },
  { title: "FC - Q4", questionOrder: 5, ttsText: "ਦੁੱਧ" },
  { title: "FC - Q4", questionOrder: 6, ttsText: "ਪਰਿਵਾਰ" },
  { title: "FC - Q4", questionOrder: 7, ttsText: "ਪੰਜ" },
  { title: "FC - Q4", questionOrder: 8, ttsText: "ਦਸ" },
  { title: "FC - Q4", questionOrder: 9, ttsText: "ਵੀਹ" },
  { title: "FC - Q4", questionOrder: 10, ttsText: "ਬਾਰੀ" },
  { title: "FC - Q4", questionOrder: 11, ttsText: "ਛੱਤ" },
  { title: "FC - Q4", questionOrder: 12, ttsText: "ਕੰਬਲ" },
  { title: "FC - Q4", questionOrder: 13, ttsText: "ਤੌਲੀਆ" },
  { title: "FC - Q4", questionOrder: 14, ttsText: "ਸ਼ੀਸ਼ਾ" },
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

    const alreadyDone =
      !force &&
      row.question_audio_pa_status === "approved" &&
      Boolean(row.question_audio_pa_url?.trim());
    if (alreadyDone) {
      skipped += 1;
      continue;
    }

    const storagePath = `${quizId}/${row.id}-pa.mp3`;
    console.log(
      `${dryRun ? "[dry-run] " : ""}TTS ${clip.title} #${clip.questionOrder} “${clip.ttsText}”`
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
