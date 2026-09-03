/**
 * Insert Sound Match words from /Users/mac/Downloads/sound_match_new_words.csv
 * Skips rows that already exist (by word_gurmukhi unique constraint).
 * Then run: npx tsx scripts/generate-word-start-audio.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

type Row = {
  word_gurmukhi: string;
  meaning_english: string;
  romanised: string;
  starting_letter: string;
  distractor_letters: string[];
  display_order: number;
};

function parseCsv(filePath: string): Row[] {
  const text = readFileSync(filePath, "utf8");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const header = lines[0];
  if (!header?.startsWith("word_gurmukhi")) {
    throw new Error(`Unexpected header: ${header}`);
  }

  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length < 5) continue;
    const word_gurmukhi = parts[0].trim();
    const meaning_english = parts.slice(1, -3).join(",").trim() || parts[1].trim();
    // Re-parse more carefully: fields are word_gurmukhi, meaning_english, romanised, starting_letter, distractor_letters
    // meaning_english can contain commas (e.g. "wok / pan") but NOT commas in CSV — let's check
    // Actually the CSV uses commas as delimiter and meaning_english has " / " not commas.
    // But some rows might have commas in meaning. Let's parse from the right since the last 2 fields are simple.
    const line = lines[i];
    const lastComma = line.lastIndexOf(",");
    const distractorStr = line.slice(lastComma + 1).trim();
    const rest1 = line.slice(0, lastComma);
    const secondLastComma = rest1.lastIndexOf(",");
    const starting_letter = rest1.slice(secondLastComma + 1).trim();
    const rest2 = rest1.slice(0, secondLastComma);
    const thirdLastComma = rest2.lastIndexOf(",");
    const romanised = rest2.slice(thirdLastComma + 1).trim();
    const rest3 = rest2.slice(0, thirdLastComma);
    const fourthLastComma = rest3.indexOf(",");
    const wordG = rest3.slice(0, fourthLastComma).trim();
    const meaningE = rest3.slice(fourthLastComma + 1).trim();

    const distractor_letters = distractorStr.split(";").map((s) => s.trim()).filter(Boolean);
    if (!wordG || !starting_letter || distractor_letters.length < 2) {
      console.warn(`Skipping malformed line ${i + 1}: ${line}`);
      continue;
    }

    rows.push({
      word_gurmukhi: wordG,
      meaning_english: meaningE,
      romanised,
      starting_letter,
      distractor_letters,
      display_order: 0, // set later
    });
  }
  return rows;
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");

  const supabase = createClient(url, key);

  // Get existing rows
  const { data: existing, error: existingError } = await supabase
    .from("word_start_game_words")
    .select("word_gurmukhi, display_order");
  if (existingError) throw new Error(existingError.message);

  const have = new Set((existing ?? []).map((r) => r.word_gurmukhi as string));
  let nextOrder = Math.max(0, ...(existing ?? []).map((r) => Number(r.display_order) || 0)) + 1;

  const csvRows = parseCsv("/Users/mac/Downloads/sound_match_new_words.csv");
  console.log(`CSV rows parsed: ${csvRows.length}`);

  const toInsert: Row[] = [];
  let skipped = 0;
  for (const row of csvRows) {
    if (have.has(row.word_gurmukhi)) {
      skipped++;
      continue;
    }
    have.add(row.word_gurmukhi); // avoid duplicates within the CSV
    toInsert.push({ ...row, display_order: nextOrder++ });
  }

  console.log(`To insert: ${toInsert.length}, already exist: ${skipped}`);

  if (toInsert.length > 0) {
    // Insert in batches of 50
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50);
      const { error } = await supabase.from("word_start_game_words").insert(batch);
      if (error) throw new Error(`Batch ${i}: ${error.message}`);
      console.log(`Inserted batch ${i + 1}–${i + batch.length}`);
    }
  }

  // Final tally
  const { data: all, error: allError } = await supabase
    .from("word_start_game_words")
    .select("starting_letter, audio_pa_url");
  if (allError) throw new Error(allError.message);

  const byLetter = new Map<string, { total: number; withAudio: number }>();
  for (const row of all ?? []) {
    const entry = byLetter.get(row.starting_letter) ?? { total: 0, withAudio: 0 };
    entry.total++;
    if (row.audio_pa_url) entry.withAudio++;
    byLetter.set(row.starting_letter, entry);
  }

  console.log(`\nTotal rows: ${all?.length ?? 0}`);
  console.log("Per letter:");
  for (const [letter, { total, withAudio }] of [...byLetter.entries()].sort((a, b) => a[0].localeCompare(b[0], "pa"))) {
    console.log(`  ${letter}: ${total} words (${withAudio} with audio, ${total - withAudio} need audio)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
