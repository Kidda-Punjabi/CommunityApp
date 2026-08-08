/**
 * Generate Punjabi + English TTS for Life in the UK / UK Driving Theory quiz questions.
 *
 * Question text only (not options / explanations).
 *
 * Usage:
 *   npx tsx scripts/generate-quiz-question-audio.ts --dry-run
 *   npx tsx scripts/generate-quiz-question-audio.ts
 *   npx tsx scripts/generate-quiz-question-audio.ts --lang=pa
 *   npx tsx scripts/generate-quiz-question-audio.ts --course=driving --force
 *   npx tsx scripts/generate-quiz-question-audio.ts --pause-ms=500
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

const AUDIO_BUCKET = "quiz-question-audio";

type QuestionRow = {
  id: string;
  quiz_id: string;
  question_text: string;
  question_text_pa: string | null;
  question_audio_en_url: string | null;
  question_audio_pa_url: string | null;
  question_audio_en_status: string | null;
  question_audio_pa_status: string | null;
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

function courseFilter(name: string): boolean {
  const courseArg = (argValue("course") ?? "both").toLowerCase();
  const n = name.toLowerCase();
  if (courseArg === "life" || courseArg === "lituk") {
    return n.includes("life") && n.includes("uk");
  }
  if (courseArg === "driving") {
    return n.includes("driving");
  }
  return (
    (n.includes("life") && n.includes("uk")) || n.includes("driving")
  );
}

async function main() {
  loadEnvLocal();

  const dryRun = hasFlag("dry-run");
  const force = hasFlag("force");
  const langArg = (argValue("lang") ?? "both").toLowerCase();
  const doPa = langArg === "both" || langArg === "pa" || langArg === "punjabi";
  const doEn = langArg === "both" || langArg === "en" || langArg === "english";
  const pauseMs = Number(argValue("pause-ms") ?? "500");

  if (!doPa && !doEn) throw new Error("Use --lang=pa|en|both");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  if (!dryRun && !process.env.ELEVENLABS_API_KEY) {
    throw new Error("Missing ELEVENLABS_API_KEY");
  }

  const supabase = createClient(url, key);
  await ensureBucket(supabase, AUDIO_BUCKET);

  const { data: courses, error: courseError } = await supabase
    .from("courses")
    .select("id, name")
    .eq("content_track", "learn_english")
    .eq("is_home_course", false);

  if (courseError) throw new Error(courseError.message);

  const selectedCourses = (courses ?? []).filter((course) =>
    courseFilter(course.name as string)
  );
  if (selectedCourses.length === 0) {
    throw new Error("No matching Life UK / Driving Theory courses");
  }

  const courseIds = selectedCourses.map((course) => course.id as string);
  const { data: quizzes, error: quizError } = await supabase
    .from("quizzes")
    .select("id, course_id")
    .in("course_id", courseIds);
  if (quizError) throw new Error(quizError.message);

  const quizIds = (quizzes ?? []).map((quiz) => quiz.id as string);
  if (quizIds.length === 0) throw new Error("No quizzes found");

  const { data: questions, error: questionError } = await supabase
    .from("quiz_questions")
    .select(
      "id, quiz_id, question_text, question_text_pa, question_audio_en_url, question_audio_pa_url, question_audio_en_status, question_audio_pa_status"
    )
    .in("quiz_id", quizIds)
    .order("question_order", { ascending: true });

  if (questionError) throw new Error(questionError.message);
  const rows = (questions ?? []) as QuestionRow[];

  console.log(
    `Courses: ${selectedCourses.map((c) => c.name).join(", ")}\nQuestions: ${rows.length}\nLang: ${langArg} force=${force} dryRun=${dryRun}`
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
      statusCol: "question_audio_pa_status" | "question_audio_en_status";
      urlCol: "question_audio_pa_url" | "question_audio_en_url";
      currentStatus: string;
      currentUrl: string | null;
    }> = [];

    if (doPa) {
      jobs.push({
        lang: "pa",
        text: row.question_text_pa?.trim() ?? "",
        voiceId: PUNJABI_LESSON_VOICE_ID,
        statusCol: "question_audio_pa_status",
        urlCol: "question_audio_pa_url",
        currentStatus: row.question_audio_pa_status ?? "none",
        currentUrl: row.question_audio_pa_url,
      });
    }
    if (doEn) {
      jobs.push({
        lang: "en",
        text: row.question_text?.trim() ?? "",
        voiceId: ENGLISH_LESSON_VOICE_ID,
        statusCol: "question_audio_en_status",
        urlCol: "question_audio_en_url",
        currentStatus: row.question_audio_en_status ?? "none",
        currentUrl: row.question_audio_en_url,
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
        console.warn(`Skip empty ${job.lang} text for ${row.id}`);
        skipped += 1;
        continue;
      }

      const storagePath = `${row.quiz_id}/${row.id}-${job.lang}.mp3`;
      console.log(
        `${dryRun ? "[dry-run] " : ""}TTS ${job.lang} ${job.text.slice(0, 56)}…`
      );

      if (dryRun) {
        generated += 1;
        continue;
      }

      await supabase
        .from("quiz_questions")
        .update({ [job.statusCol]: "pending_review" })
        .eq("id", row.id);

      try {
        const { audio } = await synthesizeSpeech({
          text: job.text,
          voiceId: job.voiceId,
          pronunciationDictionaryLocators:
            job.lang === "pa" && pronunciation ? [pronunciation] : undefined,
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
          .from("quiz_questions")
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
