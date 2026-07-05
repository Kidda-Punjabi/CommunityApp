/**
 * Idempotent dictionary TTS: auto-approve new clips, never touch existing assets.
 *
 * - Original master-deck words: word + example audio when missing.
 * - CSV-imported new words: word + example audio when missing.
 * - Skips any flashcard / flashcard_example row that already exists in audio_assets
 *   (approved, pending_review, needs_changes, or none).
 *
 * Usage:
 *   npx tsx scripts/seed-dictionary-audio-full.ts --csv=../kidda_dictionary_expansion.csv
 *   npx tsx scripts/seed-dictionary-audio-full.ts --csv=words.csv --pause-ms=1200
 *   npx tsx scripts/seed-dictionary-audio-full.ts --csv=words.csv --dry-run
 *   npx tsx scripts/seed-dictionary-audio-full.ts --csv=words.csv --verify-only
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELEVENLABS_API_KEY
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateAndAutoApproveContentAudio } from "../src/lib/audio/generate-audio";
import type { AudioContentType } from "../src/lib/audio/types";

const MASTER_DECK_NAME = "Vocabulary - Master List";

type FlashcardRow = {
  id: string;
  front_text: string;
  back_text: string;
  romanised: string | null;
  category: string | null;
  example_sentence_gurmukhi: string | null;
  created_at: string;
};

type SlotStats = {
  generated: number;
  skippedExisting: number;
  skippedPolicy: number;
  failed: number;
};

type CohortStats = {
  cards: number;
  word: SlotStats;
  example: SlotStats;
};

function emptySlotStats(): SlotStats {
  return { generated: 0, skippedExisting: 0, skippedPolicy: 0, failed: 0 };
}

function emptyCohortStats(): CohortStats {
  return { cards: 0, word: emptySlotStats(), example: emptySlotStats() };
}

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

function assetKey(contentType: AudioContentType, contentId: string): string {
  return `${contentType}:${contentId}`;
}

function wordTtsScript(gurmukhi: string, romanised: string | null): string {
  const g = gurmukhi.trim();
  if (/[\u0A00-\u0A7F]/.test(g)) return g;
  return romanised?.trim() || g;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  fields.push(current.trim());
  return fields;
}

function loadNewWordGurmukhiFromCsv(csvPath: string): Set<string> {
  const text = readFileSync(csvPath, "utf8");
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (lines.length < 2) return new Set();

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const gurmukhiIdx = headers.indexOf("gurmukhi");
  if (gurmukhiIdx === -1) {
    throw new Error("CSV missing required column: gurmukhi");
  }

  const set = new Set<string>();
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const gurmukhi = (cols[gurmukhiIdx] ?? "").trim().toLowerCase();
    if (gurmukhi) set.add(gurmukhi);
  }
  return set;
}

async function resolveReviewerId(supabase: SupabaseClient): Promise<string | null> {
  const fromArg = argValue("reviewer-id");
  if (fromArg) return fromArg;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .in("app_role", ["master_admin", "community_lead"])
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("Could not load reviewer profile:", error.message);
    return null;
  }

  return (data as { id: string } | null)?.id ?? null;
}

async function loadExistingAssetSnapshot(supabase: SupabaseClient) {
  const keys = new Set<string>();
  const snapshot = new Map<
    string,
    { status: string; audio_url: string | null; updated_at: string | null }
  >();

  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("audio_assets")
      .select("content_type, content_id, status, audio_url, updated_at")
      .in("content_type", ["flashcard", "flashcard_example"])
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to load audio_assets snapshot: ${error.message}`);

    const rows = data ?? [];
    for (const row of rows) {
      const key = assetKey(row.content_type as AudioContentType, row.content_id as string);
      keys.add(key);
      snapshot.set(key, {
        status: row.status as string,
        audio_url: (row.audio_url as string | null) ?? null,
        updated_at: (row.updated_at as string | null) ?? null,
      });
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return { keys, snapshot };
}

async function verifySnapshotUntouched(
  supabase: SupabaseClient,
  before: Map<string, { status: string; audio_url: string | null; updated_at: string | null }>
): Promise<string[]> {
  const issues: string[] = [];

  for (const [key, prev] of before) {
    const [contentType, contentId] = key.split(":");
    const { data, error } = await supabase
      .from("audio_assets")
      .select("status, audio_url, updated_at")
      .eq("content_type", contentType)
      .eq("content_id", contentId)
      .maybeSingle();

    if (error) {
      issues.push(`${key}: re-query failed (${error.message})`);
      continue;
    }

    if (!data) {
      issues.push(`${key}: row disappeared (was ${prev.status})`);
      continue;
    }

    if (data.status !== prev.status) {
      issues.push(`${key}: status changed ${prev.status} → ${data.status}`);
      continue;
    }

    if (prev.status === "approved" && (data.audio_url ?? null) !== prev.audio_url) {
      issues.push(`${key}: approved audio_url changed`);
      continue;
    }

    if (prev.updated_at && data.updated_at && data.updated_at < prev.updated_at) {
      issues.push(`${key}: updated_at rolled back`);
    }
  }

  return issues;
}

function pickRandom<T>(items: T[], count: number): T[] {
  if (items.length <= count) return [...items];
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

async function verifyPlayableSamples(
  supabase: SupabaseClient,
  originalCards: FlashcardRow[],
  newCards: FlashcardRow[]
): Promise<void> {
  const sampleSize = 10;
  const originalSample = pickRandom(originalCards, sampleSize);
  const newSample = pickRandom(newCards, sampleSize);
  const allIds = [...originalSample, ...newSample].map((card) => card.id);

  if (allIds.length === 0) {
    console.log("\nVerification: no cards available to sample.");
    return;
  }

  const { data, error } = await supabase
    .from("audio_assets")
    .select("content_type, content_id, status, audio_url")
    .in("content_type", ["flashcard", "flashcard_example"])
    .in("content_id", allIds)
    .eq("status", "approved");

  if (error) {
    console.error("\nVerification failed to load approved audio:", error.message);
    return;
  }

  const approved = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const key = row.content_id as string;
    const types = approved.get(key) ?? new Set<string>();
    if (row.audio_url?.trim()) types.add(row.content_type as string);
    approved.set(key, types);
  }

  console.log("\nVerification — dictionary play buttons (approved audio required):");

  let originalWordOk = 0;
  let originalOk = 0;
  for (const card of originalSample) {
    const types = approved.get(card.id) ?? new Set<string>();
    const wordOk = types.has("flashcard");
    const exampleOk = card.example_sentence_gurmukhi?.trim()
      ? types.has("flashcard_example")
      : true;
    if (wordOk) originalWordOk++;
    if (wordOk && exampleOk) originalOk++;
    console.log(
      `  original ${wordOk && exampleOk ? "OK" : "MISSING"} — ${card.front_text} (word ${wordOk ? "yes" : "no"}, example ${exampleOk ? "yes" : "no"})`
    );
  }

  let newWordOk = 0;
  let newExampleOk = 0;
  for (const card of newSample) {
    const types = approved.get(card.id) ?? new Set<string>();
    const wordOk = types.has("flashcard");
    const exampleOk = card.example_sentence_gurmukhi?.trim()
      ? types.has("flashcard_example")
      : true;
    if (wordOk) newWordOk++;
    if (exampleOk) newExampleOk++;
    console.log(
      `  new ${wordOk && exampleOk ? "OK" : "MISSING"} — ${card.front_text} (word ${wordOk ? "yes" : "no"}, example ${exampleOk ? "yes" : "no"})`
    );
  }

  console.log(
    `  Sample summary: original words ${originalWordOk}/${originalSample.length}, original full ${originalOk}/${originalSample.length}, new words ${newWordOk}/${newSample.length}, new examples ${newExampleOk}/${newSample.length}`
  );
}

function printSlot(label: string, stats: SlotStats) {
  console.log(
    `    ${label}: generated ${stats.generated}, skipped (existing) ${stats.skippedExisting}, skipped (policy) ${stats.skippedPolicy}, failed ${stats.failed}`
  );
}

function printCohort(title: string, stats: CohortStats) {
  console.log(`  ${title} (${stats.cards} cards)`);
  printSlot("word", stats.word);
  printSlot("example", stats.example);
}

async function loadMasterVocabCards(
  supabase: SupabaseClient,
  masterDeckId: string
): Promise<FlashcardRow[]> {
  const pageSize = 1000;
  let from = 0;
  const all: FlashcardRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("flashcards")
      .select(
        "id, front_text, back_text, romanised, category, example_sentence_gurmukhi, created_at"
      )
      .eq("deck_id", masterDeckId)
      .eq("category", "vocab")
      .order("front_text")
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to load flashcards: ${error.message}`);

    const rows = (data ?? []) as FlashcardRow[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function main() {
  loadEnvLocal();

  const csvArg = argValue("csv");
  const dryRun = process.argv.includes("--dry-run");
  const verifyOnly = process.argv.includes("--verify-only");
  const pauseMs = Math.max(0, parseInt(argValue("pause-ms") ?? "1200", 10));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  if (!csvArg) {
    console.error(
      "Usage: npx tsx scripts/seed-dictionary-audio-full.ts --csv=path/to/import.csv [--pause-ms=1200] [--dry-run] [--verify-only]"
    );
    process.exit(1);
  }

  const resolvedCsv = resolve(csvArg);
  if (!existsSync(resolvedCsv)) {
    console.error(`CSV not found: ${resolvedCsv}`);
    process.exit(1);
  }

  const newWordGurmukhi = loadNewWordGurmukhiFromCsv(resolvedCsv);
  console.log(`Loaded ${newWordGurmukhi.size} Gurmukhi entries from CSV for "new words" cohort.`);

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: masterSet } = await supabase
    .from("flashcard_sets")
    .select("id")
    .eq("name", MASTER_DECK_NAME)
    .maybeSingle();

  if (!masterSet) {
    console.error(`Master deck "${MASTER_DECK_NAME}" not found.`);
    process.exit(1);
  }

  let cardList: FlashcardRow[];
  try {
    cardList = await loadMasterVocabCards(supabase, masterSet.id);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
  const originalCards = cardList.filter(
    (card) => !newWordGurmukhi.has(card.back_text.trim().toLowerCase())
  );
  const newCards = cardList.filter((card) =>
    newWordGurmukhi.has(card.back_text.trim().toLowerCase())
  );

  console.log(
    `Master deck vocab: ${cardList.length} total — ${originalCards.length} original, ${newCards.length} new (CSV-matched).`
  );

  if (verifyOnly) {
    await verifyPlayableSamples(supabase, originalCards, newCards);
    return;
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    console.error("Missing ELEVENLABS_API_KEY.");
    process.exit(1);
  }

  const reviewerId = await resolveReviewerId(supabase);
  if (!reviewerId) {
    console.error("No reviewer profile found — pass --reviewer-id=<uuid>.");
    process.exit(1);
  }
  const reviewerUserId: string = reviewerId;

  const { keys: existingKeys, snapshot: beforeSnapshot } =
    await loadExistingAssetSnapshot(supabase);
  console.log(
    `Pre-flight: ${existingKeys.size} existing audio_assets rows for flashcard / flashcard_example (will not touch).`
  );

  const stats = {
    original: emptyCohortStats(),
    new: emptyCohortStats(),
  };
  stats.original.cards = originalCards.length;
  stats.new.cards = newCards.length;

  async function processSlot(
    cohort: "original" | "new",
    slot: "word" | "example",
    contentType: AudioContentType,
    card: FlashcardRow,
    script: string | null,
    allowed: boolean
  ) {
    const slotStats = stats[cohort][slot];

    if (!allowed) {
      slotStats.skippedPolicy++;
      return;
    }

    if (!script?.trim()) {
      slotStats.skippedPolicy++;
      return;
    }

    const key = assetKey(contentType, card.id);
    if (existingKeys.has(key)) {
      slotStats.skippedExisting++;
      return;
    }

    if (dryRun) {
      console.log(`[dry-run] would generate+approve ${contentType} — ${card.front_text}`);
      slotStats.generated++;
      existingKeys.add(key);
      return;
    }

    const result = await generateAndAutoApproveContentAudio(supabase, contentType, card.id, {
      scriptOverride: script.trim(),
      reviewerId: reviewerUserId,
    });

    if (!result.ok) {
      if (result.skipped) {
        slotStats.skippedExisting++;
        existingKeys.add(key);
        return;
      }
      console.error(`  failed ${contentType} ${card.front_text}: ${result.error}`);
      slotStats.failed++;
      return;
    }

    slotStats.generated++;
    existingKeys.add(key);

    if (pauseMs > 0) await sleep(pauseMs);
  }

  for (const card of originalCards) {
    await processSlot(
      "original",
      "word",
      "flashcard",
      card,
      wordTtsScript(card.back_text, card.romanised),
      true
    );

    await processSlot(
      "original",
      "example",
      "flashcard_example",
      card,
      card.example_sentence_gurmukhi,
      true
    );
  }

  for (const card of newCards) {
    await processSlot(
      "new",
      "word",
      "flashcard",
      card,
      wordTtsScript(card.back_text, card.romanised),
      true
    );

    await processSlot(
      "new",
      "example",
      "flashcard_example",
      card,
      card.example_sentence_gurmukhi,
      true
    );
  }

  console.log("\nSummary:");
  printCohort("Original words", stats.original);
  printCohort("New words (CSV import)", stats.new);

  const totalGenerated =
    stats.original.word.generated +
    stats.original.example.generated +
    stats.new.word.generated +
    stats.new.example.generated;
  const totalSkippedExisting =
    stats.original.word.skippedExisting +
    stats.original.example.skippedExisting +
    stats.new.word.skippedExisting +
    stats.new.example.skippedExisting;

  console.log(
    `\nTotals: ${totalGenerated} newly generated+approved, ${totalSkippedExisting} skipped (already in audio_assets).`
  );

  if (!dryRun) {
    const issues = await verifySnapshotUntouched(supabase, beforeSnapshot);
    if (issues.length > 0) {
      console.error("\nIntegrity check FAILED — pre-existing audio_assets rows were modified:");
      for (const issue of issues.slice(0, 20)) {
        console.error(`  ${issue}`);
      }
      if (issues.length > 20) {
        console.error(`  …and ${issues.length - 20} more`);
      }
      process.exit(1);
    }
    console.log(
      `\nIntegrity check OK — all ${beforeSnapshot.size} pre-existing audio_assets rows unchanged.`
    );

    await verifyPlayableSamples(supabase, originalCards, newCards);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
