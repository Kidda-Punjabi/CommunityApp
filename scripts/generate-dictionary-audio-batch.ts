/**
 * Batch-generate dictionary word + example sentence audio (pending review).
 * Targets master-deck vocab cards missing audio or needing regeneration.
 *
 * Usage:
 *   npx tsx scripts/generate-dictionary-audio-batch.ts
 *   npx tsx scripts/generate-dictionary-audio-batch.ts --limit=50
 *   npx tsx scripts/generate-dictionary-audio-batch.ts --flashcard-id=<uuid>
 *   npx tsx scripts/generate-dictionary-audio-batch.ts --only-examples
 *   npx tsx scripts/generate-dictionary-audio-batch.ts --force --pause-ms=2000
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELEVENLABS_API_KEY
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { generateContentAudio } from "../src/lib/audio/generate-audio";

const MASTER_DECK_NAME = "Vocabulary - Master List";

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function wordTtsScript(gurmukhi: string, romanised: string | null): string {
  const g = gurmukhi.trim();
  if (/[\u0A00-\u0A7F]/.test(g)) return g;
  return romanised?.trim() || g;
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
  const flashcardId = argValue("flashcard-id");
  const onlyExamples = process.argv.includes("--only-examples");
  const force = process.argv.includes("--force");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (flashcardId) {
    const { data: card } = await supabase
      .from("flashcards")
      .select("id, front_text, back_text, romanised, example_sentence_gurmukhi")
      .eq("id", flashcardId)
      .single();

    if (!card) {
      console.error("Flashcard not found.");
      process.exit(1);
    }

    if (!onlyExamples) {
      const wordResult = await generateContentAudio(supabase, "flashcard", card.id, {
        scriptOverride: wordTtsScript(card.back_text, card.romanised),
        force,
      });
      console.log("Word:", wordResult.ok ? "queued" : wordResult.error);
    }

    if (card.example_sentence_gurmukhi?.trim()) {
      const exampleResult = await generateContentAudio(supabase, "flashcard_example", card.id, {
        scriptOverride: card.example_sentence_gurmukhi.trim(),
        force,
      });
      console.log("Example:", exampleResult.ok ? "queued" : exampleResult.error);
    }

    return;
  }

  const { data: masterSet } = await supabase
    .from("flashcard_sets")
    .select("id")
    .eq("name", MASTER_DECK_NAME)
    .maybeSingle();

  if (!masterSet) {
    console.error(`Master deck "${MASTER_DECK_NAME}" not found.`);
    process.exit(1);
  }

  const { data: cards, error: cardsError } = await supabase
    .from("flashcards")
    .select("id, front_text, back_text, romanised, example_sentence_gurmukhi")
    .eq("deck_id", masterSet.id)
    .order("front_text");

  if (cardsError) {
    console.error(cardsError.message);
    process.exit(1);
  }

  const cardList = cards ?? [];
  const cardIds = cardList.map((card) => card.id);

  const { data: assets } = await supabase
    .from("audio_assets")
    .select("content_type, content_id, status")
    .in("content_type", ["flashcard", "flashcard_example"])
    .in("content_id", cardIds);

  const assetStatus = new Map<string, string>();
  for (const asset of assets ?? []) {
    assetStatus.set(`${asset.content_type}:${asset.content_id}`, asset.status);
  }

  let processed = 0;

  for (const card of cardList) {
    if (processed >= limit) break;

    const wordKey = `flashcard:${card.id}`;
    const exampleKey = `flashcard_example:${card.id}`;
    const wordStatus = assetStatus.get(wordKey);
    const exampleStatus = assetStatus.get(exampleKey);

    const needsWord =
      !onlyExamples &&
      (force || !wordStatus || wordStatus === "none" || wordStatus === "needs_changes");
    const needsExample =
      Boolean(card.example_sentence_gurmukhi?.trim()) &&
      (force ||
        !exampleStatus ||
        exampleStatus === "none" ||
        exampleStatus === "needs_changes");

    if (!needsWord && !needsExample) continue;

    if (needsWord) {
      const result = await generateContentAudio(supabase, "flashcard", card.id, {
        scriptOverride: wordTtsScript(card.back_text, card.romanised),
        force,
      });
      if (result.ok) {
        console.log(`Word queued: ${card.front_text}`);
        processed++;
      } else if (!result.skipped) {
        console.error(`Word failed (${card.front_text}):`, result.error);
      }
      if (pauseMs > 0) await sleep(pauseMs);
    }

    if (needsExample && processed < limit) {
      const result = await generateContentAudio(supabase, "flashcard_example", card.id, {
        scriptOverride: card.example_sentence_gurmukhi!.trim(),
        force,
      });
      if (result.ok) {
        console.log(`Example queued: ${card.front_text}`);
        processed++;
      } else if (!result.skipped) {
        console.error(`Example failed (${card.front_text}):`, result.error);
      }
      if (pauseMs > 0) await sleep(pauseMs);
    }
  }

  console.log(`Done. Processed ${processed} generation(s). Review in Admin → Audio review.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
