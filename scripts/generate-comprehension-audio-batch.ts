/**
 * Batch-generate comprehension sentence audio via ElevenLabs → Supabase (pending review).
 *
 * Usage:
 *   npx tsx scripts/generate-comprehension-audio-batch.ts
 *   npx tsx scripts/generate-comprehension-audio-batch.ts --limit=10
 *   npx tsx scripts/generate-comprehension-audio-batch.ts --sentence-id=<uuid> --force
 *   npx tsx scripts/generate-comprehension-audio-batch.ts --pause-ms=2000
 *
 * Requires in .env.local:
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

  const limit = Math.max(1, parseInt(argValue("limit") ?? "9999", 10));
  const pauseMs = Math.max(0, parseInt(argValue("pause-ms") ?? "2000", 10));
  const forceSentenceId = argValue("sentence-id");
  const force = process.argv.includes("--force");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (forceSentenceId) {
    console.log(`Generating single sentence ${forceSentenceId} (force=${force})…`);
    const result = await generateContentAudio(
      supabase,
      "comprehension_sentence",
      forceSentenceId,
      { force }
    );
    if (!result.ok) {
      console.error("Failed:", result.error);
      process.exit(1);
    }
    console.log("Done:", result.storagePath);
    return;
  }

  const { data: scripts, error: scriptsError } = await supabase
    .from("comprehension_scripts")
    .select("id, title, display_order")
    .order("display_order");

  if (scriptsError) {
    console.error("Failed to load scripts:", scriptsError.message);
    process.exit(1);
  }

  const scriptOrder = new Map(
    (scripts ?? []).map((script, index) => [script.id as string, index])
  );
  const scriptTitle = new Map(
    (scripts ?? []).map((script) => [script.id as string, script.title as string])
  );

  const { data: sentences, error: sentencesError } = await supabase
    .from("comprehension_sentences")
    .select("id, script_id, sequence_order, gurmukhi_text")
    .order("sequence_order");

  if (sentencesError) {
    console.error("Failed to load sentences:", sentencesError.message);
    process.exit(1);
  }

  const { data: assets, error: assetsError } = await supabase
    .from("audio_assets")
    .select("content_id, status")
    .eq("content_type", "comprehension_sentence");

  if (assetsError) {
    console.error("Failed to load audio assets:", assetsError.message);
    process.exit(1);
  }

  const statusBySentenceId = new Map(
    (assets ?? []).map((row) => [row.content_id as string, row.status as string])
  );

  const queue = (sentences ?? [])
    .filter((sentence) => {
      const status = statusBySentenceId.get(sentence.id as string);
      return !status || status === "none";
    })
    .sort((a, b) => {
      const scriptDiff =
        (scriptOrder.get(a.script_id as string) ?? 0) -
        (scriptOrder.get(b.script_id as string) ?? 0);
      if (scriptDiff !== 0) return scriptDiff;
      return (a.sequence_order as number) - (b.sequence_order as number);
    })
    .slice(0, limit);

  const totalMissing = (sentences ?? []).filter((sentence) => {
    const status = statusBySentenceId.get(sentence.id as string);
    return !status || status === "none";
  }).length;

  console.log(
    `Found ${totalMissing} comprehension sentence(s) not yet generated; processing ${queue.length}.`
  );

  if (queue.length === 0) {
    return;
  }

  let totalOk = 0;
  let totalFail = 0;

  for (let i = 0; i < queue.length; i += 1) {
    const sentence = queue[i];
    const title = scriptTitle.get(sentence.script_id as string) ?? "Script";
    const label = `${title} · sentence ${sentence.sequence_order}`;
    const preview = (sentence.gurmukhi_text as string).trim().slice(0, 40);

    const result = await generateContentAudio(
      supabase,
      "comprehension_sentence",
      sentence.id as string,
      { batchMode: true }
    );

    if (!result.ok) {
      totalFail += 1;
      console.log(`  FAIL  [${i + 1}/${queue.length}] ${label}: ${result.error}`);
      continue;
    }

    totalOk += 1;
    console.log(
      `  OK    [${i + 1}/${queue.length}] ${label} (${preview}…) → ${result.storagePath}`
    );

    if (i + 1 < queue.length && pauseMs > 0) {
      await sleep(pauseMs);
    }
  }

  console.log(`\nSummary: ${totalOk} succeeded, ${totalFail} failed.`);
  if (totalOk > 0) {
    console.log("Review pending clips in Admin → Content → Audio review (or Games → Comprehension).");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
