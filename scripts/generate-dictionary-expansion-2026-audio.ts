/**
 * Generate audio for dictionary expansion batch 1 (dictionary_expansion_2026) only.
 *
 * Targets flashcards tagged topic_tags ⊇ 'dictionary_expansion_2026'
 * (expected: 53 rows on Vocabulary - Master List).
 *
 * - Script = flashcards.back_text (Gurmukhi)
 * - Voice = Yatin (PUNJABI_LESSON_VOICE_ID), same as other flashcard TTS
 * - Inserts audio_assets with status = 'none' (NOT approved — needs review)
 * - Idempotent: skips any flashcard that already has a flashcard audio_assets row
 * - Does NOT touch other flashcards (including dictionary_expansion_2026_b2 / batch 2)
 *
 * Usage:
 *   npx tsx scripts/generate-dictionary-expansion-2026-audio.ts
 *   npx tsx scripts/generate-dictionary-expansion-2026-audio.ts --limit=5
 *   npx tsx scripts/generate-dictionary-expansion-2026-audio.ts --dry-run
 *   npx tsx scripts/generate-dictionary-expansion-2026-audio.ts --verify-only
 *   npx tsx scripts/generate-dictionary-expansion-2026-audio.ts --pause-ms=1500
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELEVENLABS_API_KEY
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicUrlForAudioPath } from "../src/lib/audio/storage";
import { PUNJABI_LESSON_VOICE_ID } from "../src/lib/elevenlabs/constants";
import { getPronunciationDictionaryLocator } from "../src/lib/elevenlabs/pronunciation-dictionary";
import { synthesizeSpeech } from "../src/lib/elevenlabs/server";

const TAG = "dictionary_expansion_2026";
const OTHER_TAG = "dictionary_expansion_2026_b2";
const DECK_ID = "b5f8673e-5cc3-4139-8379-36b035837676";
const CONTENT_TYPE = "flashcard";
const BUCKET = "lesson-audio";
const VOICE_ID = PUNJABI_LESSON_VOICE_ID;
/** Rough Creator/Pro multilingual rate for reporting only — ElevenLabs bill is authoritative. */
const EST_USD_PER_1K_CHARS = 0.18;

type FlashcardRow = {
  id: string;
  front_text: string;
  back_text: string;
  romanised: string | null;
  topic_tags: string[] | null;
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function storagePathFor(flashcardId: string): string {
  return `flashcards/${flashcardId}.mp3`;
}

async function loadTaggedCards(supabase: SupabaseClient): Promise<FlashcardRow[]> {
  const { data, error } = await supabase
    .from("flashcards")
    .select("id, front_text, back_text, romanised, topic_tags")
    .eq("deck_id", DECK_ID)
    .contains("topic_tags", [TAG])
    .order("front_text");

  if (error) throw new Error(`Failed to load ${TAG} flashcards: ${error.message}`);
  return (data ?? []) as FlashcardRow[];
}

async function loadExistingFlashcardAssets(
  supabase: SupabaseClient,
  contentIds: string[]
): Promise<Map<string, { id: string; status: string; storage_path: string | null }>> {
  const map = new Map<string, { id: string; status: string; storage_path: string | null }>();
  if (contentIds.length === 0) return map;

  const chunkSize = 200;
  for (let i = 0; i < contentIds.length; i += chunkSize) {
    const chunk = contentIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("audio_assets")
      .select("id, content_id, status, storage_path")
      .eq("content_type", CONTENT_TYPE)
      .in("content_id", chunk);

    if (error) throw new Error(`audio_assets lookup failed: ${error.message}`);
    for (const row of data ?? []) {
      map.set(row.content_id as string, {
        id: row.id as string,
        status: row.status as string,
        storage_path: (row.storage_path as string | null) ?? null,
      });
    }
  }
  return map;
}

async function countOtherBatchAssets(supabase: SupabaseClient): Promise<{
  cards: number;
  assets: number;
  byStatus: Record<string, number>;
}> {
  const { data: cards, error } = await supabase
    .from("flashcards")
    .select("id")
    .eq("deck_id", DECK_ID)
    .contains("topic_tags", [OTHER_TAG]);

  if (error) throw new Error(`Failed to load other batch: ${error.message}`);
  const ids = (cards ?? []).map((c) => c.id as string);
  const assets = await loadExistingFlashcardAssets(supabase, ids);
  const byStatus: Record<string, number> = {};
  for (const asset of assets.values()) {
    byStatus[asset.status] = (byStatus[asset.status] ?? 0) + 1;
  }
  return { cards: ids.length, assets: assets.size, byStatus };
}

async function countAllFlashcardAssets(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("audio_assets")
    .select("id", { count: "exact", head: true })
    .eq("content_type", CONTENT_TYPE);
  if (error) throw new Error(`Failed to count flashcard audio_assets: ${error.message}`);
  return count ?? 0;
}

async function verifyBatch(
  supabase: SupabaseClient,
  cards: FlashcardRow[]
): Promise<{
  ok: boolean;
  withAsset: number;
  approved: number;
  none: number;
  other: Record<string, number>;
}> {
  const assets = await loadExistingFlashcardAssets(
    supabase,
    cards.map((c) => c.id)
  );
  let approved = 0;
  let none = 0;
  const other: Record<string, number> = {};
  for (const card of cards) {
    const asset = assets.get(card.id);
    if (!asset) continue;
    if (asset.status === "approved") approved += 1;
    else if (asset.status === "none") none += 1;
    else other[asset.status] = (other[asset.status] ?? 0) + 1;
  }
  return {
    ok: assets.size === cards.length && approved === 0,
    withAsset: assets.size,
    approved,
    none,
    other,
  };
}

async function processCard(
  supabase: SupabaseClient,
  card: FlashcardRow,
  existing: { id: string; status: string } | undefined,
  pronunciationLocators: Awaited<ReturnType<typeof getPronunciationDictionaryLocator>>[] | undefined,
  dryRun: boolean
): Promise<{
  outcome: "generated" | "skipped_existing" | "skipped_empty" | "dry_run";
  charactersSent: number;
  assetId?: string;
}> {
  if (existing) {
    return { outcome: "skipped_existing", charactersSent: 0, assetId: existing.id };
  }

  const scriptText = card.back_text?.trim() ?? "";
  if (!scriptText) {
    console.warn(`  skip empty back_text: ${card.id} (${card.front_text})`);
    return { outcome: "skipped_empty", charactersSent: 0 };
  }

  if (dryRun) {
    return { outcome: "dry_run", charactersSent: scriptText.length };
  }

  const synth = await synthesizeSpeech({
    text: scriptText,
    voiceId: VOICE_ID,
    pronunciationDictionaryLocators: pronunciationLocators,
  });

  const storagePath = storagePathFor(card.id);
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, synth.audio, {
    contentType: "audio/mpeg",
    upsert: false,
  });

  if (uploadError) {
    throw new Error(`Upload failed for ${card.id} (${card.front_text}): ${uploadError.message}`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const audioUrl = publicUrlForAudioPath(supabaseUrl, BUCKET, storagePath);

  const { data: asset, error: insertError } = await supabase
    .from("audio_assets")
    .insert({
      content_type: CONTENT_TYPE,
      content_id: card.id,
      script_text: scriptText,
      storage_path: storagePath,
      audio_url: audioUrl,
      status: "none",
    })
    .select("id, status")
    .single();

  if (insertError || !asset) {
    throw new Error(
      `audio_assets insert failed for ${card.id}: ${insertError?.message ?? "no row"}`
    );
  }

  if (asset.status !== "none") {
    throw new Error(
      `Refusing unexpected status "${asset.status}" for new flashcard asset ${asset.id}`
    );
  }

  return {
    outcome: "generated",
    charactersSent: synth.normalizedText.length,
    assetId: asset.id,
  };
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  if (!process.env.ELEVENLABS_API_KEY && !process.argv.includes("--verify-only") && !process.argv.includes("--dry-run")) {
    console.error("Missing ELEVENLABS_API_KEY.");
    process.exit(1);
  }

  if (VOICE_ID !== "ttyKbP9zTIRyRCN6b2Ye") {
    console.error(`Unexpected voice id ${VOICE_ID}; refusing to run.`);
    process.exit(1);
  }

  const limit = Math.max(1, parseInt(argValue("limit") ?? "9999", 10));
  const pauseMs = Math.max(0, parseInt(argValue("pause-ms") ?? "1500", 10));
  const dryRun = process.argv.includes("--dry-run");
  const verifyOnly = process.argv.includes("--verify-only");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cards = await loadTaggedCards(supabase);
  console.log(`Loaded ${cards.length} flashcards with tag ${TAG} (deck ${DECK_ID}).`);
  if (cards.length !== 53) {
    console.warn(`Expected 53 cards; got ${cards.length}. Continuing with actual set.`);
  }

  const otherBatch = await countOtherBatchAssets(supabase);
  const totalAssetsBefore = await countAllFlashcardAssets(supabase);
  console.log(
    `Other batch (${OTHER_TAG}): ${otherBatch.cards} cards, ${otherBatch.assets} flashcard audio_assets`,
    otherBatch.byStatus
  );
  console.log(`Total flashcard audio_assets before: ${totalAssetsBefore}`);

  if (verifyOnly) {
    const result = await verifyBatch(supabase, cards);
    console.log("Verification:", result);
    const otherAfter = await countOtherBatchAssets(supabase);
    console.log(`Other batch unchanged check: ${otherAfter.assets} assets`, otherAfter.byStatus);
    if (!result.ok || result.withAsset !== cards.length || result.approved > 0) {
      process.exit(1);
    }
    console.log("OK — all batch-1 cards have audio_assets, none approved.");
    return;
  }

  const existing = await loadExistingFlashcardAssets(
    supabase,
    cards.map((c) => c.id)
  );

  let pronunciationLocators:
    | Awaited<ReturnType<typeof getPronunciationDictionaryLocator>>[]
    | undefined;
  if (!dryRun) {
    const locator = await getPronunciationDictionaryLocator(supabase);
    pronunciationLocators = locator ? [locator] : undefined;
  }

  let generated = 0;
  let skippedExisting = 0;
  let skippedEmpty = 0;
  let failed = 0;
  let charactersSent = 0;
  let processed = 0;

  for (const card of cards) {
    if (processed >= limit) break;
    processed += 1;

    try {
      const result = await processCard(
        supabase,
        card,
        existing.get(card.id),
        pronunciationLocators,
        dryRun
      );
      charactersSent += result.charactersSent;

      if (result.outcome === "generated") {
        generated += 1;
        console.log(
          `  generated ${card.front_text} → ${result.assetId} (${result.charactersSent} chars) status=none`
        );
        if (pauseMs > 0) await sleep(pauseMs);
      } else if (result.outcome === "dry_run") {
        generated += 1;
        console.log(`  dry-run ${card.front_text} (${result.charactersSent} chars)`);
      } else if (result.outcome === "skipped_existing") {
        skippedExisting += 1;
        console.log(`  skip existing ${card.front_text} → ${result.assetId}`);
      } else {
        skippedEmpty += 1;
      }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  FAILED ${card.front_text} (${card.id}): ${message}`);
      if (pauseMs > 0) await sleep(pauseMs);
    }
  }

  const verify = await verifyBatch(supabase, cards);
  const otherAfter = await countOtherBatchAssets(supabase);
  const totalAssetsAfter = await countAllFlashcardAssets(supabase);

  console.log("\n=== Summary ===");
  console.log(`Tag: ${TAG}`);
  console.log(`Cards in batch: ${cards.length}`);
  console.log(`Processed this run (limit=${limit}): ${processed}`);
  console.log(`Generated: ${generated}`);
  console.log(`Skipped existing: ${skippedExisting}`);
  console.log(`Skipped empty: ${skippedEmpty}`);
  console.log(`Failed: ${failed}`);
  console.log(`ElevenLabs characters sent (normalized): ${charactersSent}`);
  console.log(
    `Estimated cost @ $${EST_USD_PER_1K_CHARS}/1k chars: $${(
      (charactersSent / 1000) *
      EST_USD_PER_1K_CHARS
    ).toFixed(4)} (estimate only)`
  );
  console.log("Post-run verify:", verify);
  console.log(
    `Other batch (${OTHER_TAG}) after run: ${otherAfter.assets} assets (was ${otherBatch.assets})`,
    otherAfter.byStatus
  );
  console.log(
    `Total flashcard audio_assets after: ${totalAssetsAfter} (was ${totalAssetsBefore}, delta=${totalAssetsAfter - totalAssetsBefore})`
  );

  if (otherAfter.assets !== otherBatch.assets) {
    console.error("ERROR: other batch audio_assets count changed — investigate.");
    process.exit(1);
  }
  if (!dryRun && totalAssetsAfter !== totalAssetsBefore + generated) {
    console.error(
      `ERROR: unexpected total flashcard asset delta — expected +${generated}, got +${totalAssetsAfter - totalAssetsBefore}`
    );
    process.exit(1);
  }
  if (!dryRun && (failed > 0 || verify.withAsset !== cards.length || verify.approved > 0)) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
