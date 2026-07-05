/**
 * Import new dictionary vocabulary rows from CSV into the master flashcard deck.
 * Does NOT update or delete existing flashcards.
 *
 * CSV columns (header row required):
 *   english, gurmukhi, romanised, gender_or_type,
 *   example_gurmukhi, example_romanised, example_english
 *
 * Optional column:
 *   topic or topic_tag — batch category tag (e.g. clothing, verbs)
 *
 * Usage:
 *   npx tsx scripts/import-dictionary-vocabulary.ts --csv=path/to/words.csv
 *   npx tsx scripts/import-dictionary-vocabulary.ts --csv=words.csv --batch=clothing --dry-run
 *   npx tsx scripts/import-dictionary-vocabulary.ts --csv=words.csv --queue-audio --pause-ms=2000
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   ELEVENLABS_API_KEY (when using --queue-audio)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { generateContentAudio } from "../src/lib/audio/generate-audio";

const MASTER_DECK_NAME = "Vocabulary - Master List";

const VALID_TOPIC_TAGS = new Set([
  "clothing",
  "household",
  "professions",
  "transport",
  "weather",
  "emotions",
  "places",
  "school",
  "technology",
  "money",
  "numbers",
  "calendar",
  "body_health",
  "verbs",
  "adjectives",
]);

type CsvRow = {
  english: string;
  gurmukhi: string;
  romanised: string;
  genderOrType: string;
  exampleGurmukhi: string;
  exampleRomanised: string;
  exampleEnglish: string;
  topic: string | null;
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

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const index = (name: string) => headers.indexOf(name);

  const required = [
    "english",
    "gurmukhi",
    "romanised",
    "gender_or_type",
    "example_gurmukhi",
    "example_romanised",
    "example_english",
  ];

  for (const column of required) {
    if (index(column) === -1) {
      throw new Error(`CSV missing required column: ${column}`);
    }
  }

  const topicIdx = index("topic");
  const topicTagIdx = index("topic_tag");
  const topicColumnIdx = topicIdx >= 0 ? topicIdx : topicTagIdx;

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return {
      english: cols[index("english")] ?? "",
      gurmukhi: cols[index("gurmukhi")] ?? "",
      romanised: cols[index("romanised")] ?? "",
      genderOrType: cols[index("gender_or_type")] ?? "",
      exampleGurmukhi: cols[index("example_gurmukhi")] ?? "",
      exampleRomanised: cols[index("example_romanised")] ?? "",
      exampleEnglish: cols[index("example_english")] ?? "",
      topic: topicColumnIdx >= 0 ? cols[topicColumnIdx] ?? null : null,
    };
  });
}

function inferTopicFromFilename(filePath: string): string | null {
  const name = basename(filePath).toLowerCase();
  for (const tag of VALID_TOPIC_TAGS) {
    if (name.includes(tag)) return tag;
  }
  return null;
}

function buildTopicTags(row: CsvRow, batchTag: string | null): string[] {
  const tags = new Set<string>();
  const raw = row.genderOrType.trim().toLowerCase();

  if (raw) {
    for (const part of raw.split(/[,;/|]+/)) {
      const token = part.trim().replace(/[{}]/g, "");
      if (!token) continue;
      if (token === "m" || token === "masculine" || token === "gender_masculine") {
        tags.add("gender_masculine");
      } else if (token === "f" || token === "feminine" || token === "gender_feminine") {
        tags.add("gender_feminine");
      } else if (token === "plural") {
        tags.add("plural");
      } else if (VALID_TOPIC_TAGS.has(token)) {
        tags.add(token);
      }
    }
  }

  const topic = (row.topic?.trim().toLowerCase().replace(/[{}]/g, "") || batchTag)?.trim();
  if (topic && VALID_TOPIC_TAGS.has(topic)) {
    tags.add(topic);
  }

  return [...tags];
}

function defaultDifficulty(topicTags: string[]): number {
  if (topicTags.includes("verbs") || topicTags.includes("adjectives")) return 2;
  return 1;
}

function wordTtsScript(gurmukhi: string, romanised: string): string {
  const g = gurmukhi.trim();
  if (/[\u0A00-\u0A7F]/.test(g)) return g;
  return romanised.trim() || g;
}

async function main() {
  loadEnvLocal();

  const csvPath = argValue("csv");
  if (!csvPath) {
    console.error("Usage: npx tsx scripts/import-dictionary-vocabulary.ts --csv=path/to/file.csv");
    process.exit(1);
  }

  const resolvedCsv = resolve(csvPath);
  if (!existsSync(resolvedCsv)) {
    console.error(`CSV not found: ${resolvedCsv}`);
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  const queueAudio = process.argv.includes("--queue-audio");
  const pauseMs = Math.max(0, parseInt(argValue("pause-ms") ?? "2000", 10));
  const batchTag =
    argValue("batch")?.trim().toLowerCase().replace(/[{}]/g, "") ??
    inferTopicFromFilename(resolvedCsv);

  if (queueAudio && !process.env.ELEVENLABS_API_KEY) {
    console.error("Missing ELEVENLABS_API_KEY (required for --queue-audio).");
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(resolvedCsv, "utf8"));
  console.log(`Parsed ${rows.length} CSV rows from ${resolvedCsv}`);

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: masterSet, error: setError } = await supabase
    .from("flashcard_sets")
    .select("id, name")
    .eq("name", MASTER_DECK_NAME)
    .maybeSingle();

  if (setError || !masterSet) {
    console.error(`Master deck "${MASTER_DECK_NAME}" not found. Create it in admin first.`);
    process.exit(1);
  }

  const { data: existingCards, error: existingError } = await supabase
    .from("flashcards")
    .select("back_text")
    .eq("deck_id", masterSet.id);

  if (existingError) {
    console.error("Failed to load existing cards:", existingError.message);
    process.exit(1);
  }

  const existingPunjabi = new Set(
    (existingCards ?? []).map((card) => card.back_text.trim().toLowerCase())
  );

  let inserted = 0;
  let skipped = 0;
  const insertedIds: string[] = [];

  for (const row of rows) {
    const english = row.english.trim();
    const gurmukhi = row.gurmukhi.trim();
    const romanised = row.romanised.trim();

    if (!english || !gurmukhi) {
      skipped++;
      continue;
    }

    if (existingPunjabi.has(gurmukhi.toLowerCase())) {
      console.log(`Skip duplicate punjabi: ${gurmukhi}`);
      skipped++;
      continue;
    }

    const topicTags = buildTopicTags(row, batchTag);
    const payload = {
      deck_id: masterSet.id,
      deck_name: masterSet.name,
      front_text: english,
      back_text: gurmukhi,
      romanised: romanised || null,
      category: "vocab" as const,
      difficulty: defaultDifficulty(topicTags),
      topic_tags: topicTags,
      example_sentence_gurmukhi: row.exampleGurmukhi.trim() || null,
      example_sentence_romanised: row.exampleRomanised.trim() || null,
      example_sentence_english: row.exampleEnglish.trim() || null,
    };

    if (dryRun) {
      console.log(`[dry-run] would insert: ${english} / ${gurmukhi}`);
      inserted++;
      existingPunjabi.add(gurmukhi.toLowerCase());
      continue;
    }

    const { data: created, error: insertError } = await supabase
      .from("flashcards")
      .insert(payload)
      .select("id")
      .single();

    if (insertError || !created) {
      console.error(`Insert failed for ${english}:`, insertError?.message);
      continue;
    }

    existingPunjabi.add(gurmukhi.toLowerCase());
    insertedIds.push(created.id);
    inserted++;
  }

  console.log(`Inserted: ${inserted}, skipped: ${skipped}`);

  if (!queueAudio || dryRun || insertedIds.length === 0) {
    return;
  }

  console.log(`Queueing TTS for ${insertedIds.length} new cards…`);

  for (const id of insertedIds) {
    const { data: card } = await supabase
      .from("flashcards")
      .select("front_text, back_text, romanised, example_sentence_gurmukhi")
      .eq("id", id)
      .single();

    if (!card) continue;

    const wordScript = wordTtsScript(card.back_text, card.romanised ?? "");
    const wordResult = await generateContentAudio(supabase, "flashcard", id, {
      scriptOverride: wordScript,
    });

    if (!wordResult.ok) {
      console.error(`Word TTS failed for ${card.front_text}:`, wordResult.error);
    } else {
      console.log(`Word TTS queued: ${card.front_text}`);
    }

    if (card.example_sentence_gurmukhi?.trim()) {
      if (pauseMs > 0) await sleep(pauseMs);
      const exampleResult = await generateContentAudio(supabase, "flashcard_example", id, {
        scriptOverride: card.example_sentence_gurmukhi.trim(),
      });
      if (!exampleResult.ok) {
        console.error(`Example TTS failed for ${card.front_text}:`, exampleResult.error);
      } else {
        console.log(`Example TTS queued: ${card.front_text}`);
      }
    }

    if (pauseMs > 0) await sleep(pauseMs);
  }

  console.log("TTS queue complete — review in Admin → Audio review.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
