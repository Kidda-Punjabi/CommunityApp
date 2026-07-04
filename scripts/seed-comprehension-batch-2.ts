/**
 * Seed Comprehension Practice scripts (Batch 2 — Short tier).
 *
 * This is a Node script — do NOT paste into Supabase SQL Editor.
 * For SQL Editor use: supabase/comprehension-short-tier-seed-batch-1-2.sql
 *
 * Usage:
 *   npx tsx scripts/seed-comprehension-batch-2.ts
 *   npx tsx scripts/seed-comprehension-batch-2.ts --dry-run
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, existsSync } from "node:fs";
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
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

type SentenceRow = {
  gurmukhi: string;
  romanised: string;
  english: string;
};

type QuestionRow = {
  gurmukhi: string;
  romanised: string;
  options: [string, string, string, string];
  correct: "a" | "b" | "c" | "d";
};

type ScriptSeed = {
  title: string;
  description: string;
  difficulty: number;
  displayOrder: number;
  sentences: SentenceRow[];
  questions: QuestionRow[];
};

const BATCH_ID = "comprehension-batch-2-short";

const SCRIPTS: ScriptSeed[] = [
  {
    title: "A trip to the market",
    description:
      "Draft — pending native speaker review. Past-tense market visit. Access: free.",
    difficulty: 2,
    displayOrder: 4,
    sentences: [
      {
        gurmukhi: "ਅਸੀਂ ਬਜ਼ਾਰ ਗਏ ਸੀ।",
        romanised: "Asi bazaar gae si.",
        english: "We had gone to the market.",
      },
      {
        gurmukhi: "ਮੈਂ ਸਬਜ਼ੀਆਂ ਖਰੀਦੀਆਂ ਸੀ।",
        romanised: "Mai sabziaa kharidiaa si.",
        english: "I had bought vegetables.",
      },
      {
        gurmukhi: "ਮੇਰੀ ਭੈਣ ਨੇ ਫਲ ਲਏ ਸੀ।",
        romanised: "Meri bhain ne phal lae si.",
        english: "My sister had bought fruit.",
      },
      {
        gurmukhi: "ਬਜ਼ਾਰ ਵਿੱਚ ਬਹੁਤ ਭੀੜ ਸੀ।",
        romanised: "Bazaar vich bahut bheed si.",
        english: "There was a big crowd in the market.",
      },
      {
        gurmukhi: "ਅਸੀਂ ਦੋ ਘੰਟੇ ਬਜ਼ਾਰ ਵਿੱਚ ਰਹੇ ਸੀ।",
        romanised: "Asi do ghante bazaar vich rahe si.",
        english: "We had stayed at the market for two hours.",
      },
    ],
    questions: [
      {
        gurmukhi: "ਮੈਂ ਕੀ ਖਰੀਦਿਆ?",
        romanised: "Mai ki kharidiya?",
        options: ["ਸਬਜ਼ੀਆਂ (sabziaa)", "ਫਲ (phal)", "ਕੱਪੜੇ (kapre)", "ਚਾਵਲ (chaaval)"],
        correct: "a",
      },
      {
        gurmukhi: "ਭੈਣ ਨੇ ਕੀ ਲਿਆ?",
        romanised: "Bhain ne ki liya?",
        options: ["ਸਬਜ਼ੀਆਂ (sabziaa)", "ਫਲ (phal)", "ਦੁੱਧ (dudh)", "ਰੋਟੀ (roti)"],
        correct: "b",
      },
      {
        gurmukhi: "ਅਸੀਂ ਬਜ਼ਾਰ ਵਿੱਚ ਕਿੰਨਾ ਸਮਾਂ ਰਹੇ?",
        romanised: "Asi bazaar vich kinna samaa rahe?",
        options: ["ਇੱਕ ਘੰਟਾ (ik ghanta)", "ਦੋ ਘੰਟੇ (do ghante)", "ਤਿੰਨ ਘੰਟੇ (tinn ghante)", "ਅੱਧਾ ਘੰਟਾ (adha ghanta)"],
        correct: "b",
      },
    ],
  },
  {
    title: "Today's weather",
    description:
      "Draft — pending native speaker review. Present weather plus one future line. Access: free.",
    difficulty: 2,
    displayOrder: 5,
    sentences: [
      {
        gurmukhi: "ਅੱਜ ਮੌਸਮ ਬਹੁਤ ਗਰਮ ਹੈ।",
        romanised: "Ajj mausam bahut garam hai.",
        english: "Today the weather is very hot.",
      },
      {
        gurmukhi: "ਅਸਮਾਨ ਸਾਫ਼ ਹੈ।",
        romanised: "Asmaan saaf hai.",
        english: "The sky is clear.",
      },
      {
        gurmukhi: "ਧੁੱਪ ਬਹੁਤ ਤੇਜ਼ ਹੈ।",
        romanised: "Dhup bahut tez hai.",
        english: "The sun is very strong.",
      },
      {
        gurmukhi: "ਮੈਨੂੰ ਠੰਡਾ ਪਾਣੀ ਪੀਣਾ ਪਸੰਦ ਹੈ।",
        romanised: "Mainu thanda pani peena pasand hai.",
        english: "I like drinking cold water.",
      },
      {
        gurmukhi: "ਕੱਲ੍ਹ ਬਾਰਿਸ਼ ਹੋਵੇਗੀ।",
        romanised: "Kallh baarish hovegi.",
        english: "Tomorrow it will rain.",
      },
    ],
    questions: [
      {
        gurmukhi: "ਅੱਜ ਮੌਸਮ ਕਿਹੋ ਜਿਹਾ ਹੈ?",
        romanised: "Ajj mausam kiho jiha hai?",
        options: ["ਗਰਮ (garam)", "ਠੰਡਾ (thanda)", "ਬਰਸਾਤੀ (barsaati)", "ਹਵਾਦਾਰ (havaadaar)"],
        correct: "a",
      },
      {
        gurmukhi: "ਅਸਮਾਨ ਕਿਹੋ ਜਿਹਾ ਹੈ?",
        romanised: "Asmaan kiho jiha hai?",
        options: ["ਬੱਦਲਵਾਈ (baddalvai)", "ਸਾਫ਼ (saaf)", "ਧੁੰਦ (dhund)", "ਰੰਗੀਨ (rangin)"],
        correct: "b",
      },
      {
        gurmukhi: "ਕੱਲ੍ਹ ਕੀ ਹੋਵੇਗਾ?",
        romanised: "Kallh ki hovega?",
        options: ["ਬਾਰਿਸ਼ (baarish)", "ਬਰਫ਼ (barf)", "ਹਵਾ (hawa)", "ਧੁੱਪ (dhup)"],
        correct: "a",
      },
    ],
  },
  {
    title: "A normal day's routine",
    description:
      "Draft — pending native speaker review. Present habitual daily routine. Access: free.",
    difficulty: 3,
    displayOrder: 6,
    sentences: [
      {
        gurmukhi: "ਮੈਂ ਹਰ ਰੋਜ਼ ਸਵੇਰੇ ਛੇ ਵਜੇ ਉੱਠਦਾ ਹਾਂ।",
        romanised: "Mai har roz savere che vaje utthda haa.",
        english: "I wake up every day at six in the morning.",
      },
      {
        gurmukhi: "ਫਿਰ ਮੈਂ ਨਹਾਉਂਦਾ ਹਾਂ ਅਤੇ ਨਾਸ਼ਤਾ ਕਰਦਾ ਹਾਂ।",
        romanised: "Phir mai nahaunda haa ate naashta karda haa.",
        english: "Then I bathe and have breakfast.",
      },
      {
        gurmukhi: "ਮੈਂ ਕੰਮ 'ਤੇ ਬੱਸ ਰਾਹੀਂ ਜਾਂਦਾ ਹਾਂ।",
        romanised: "Mai kaam te bus raheen jaanda haa.",
        english: "I go to work by bus.",
      },
      {
        gurmukhi: "ਸ਼ਾਮ ਨੂੰ ਮੈਂ ਪਰਿਵਾਰ ਨਾਲ ਸਮਾਂ ਬਿਤਾਉਂਦਾ ਹਾਂ।",
        romanised: "Shaam nu mai parivar naal samaa bitaunda haa.",
        english: "In the evening I spend time with family.",
      },
      {
        gurmukhi: "ਰਾਤ ਨੂੰ ਮੈਂ ਦਸ ਵਜੇ ਸੌਂ ਜਾਂਦਾ ਹਾਂ।",
        romanised: "Raat nu mai das vaje saun jaanda haa.",
        english: "At night I go to sleep at ten.",
      },
    ],
    questions: [
      {
        gurmukhi: "ਮੈਂ ਸਵੇਰੇ ਕਦੋਂ ਉੱਠਦਾ ਹਾਂ?",
        romanised: "Mai savere kadon utthda haa?",
        options: ["ਪੰਜ ਵਜੇ (panj vaje)", "ਛੇ ਵਜੇ (che vaje)", "ਸੱਤ ਵਜੇ (satt vaje)", "ਅੱਠ ਵਜੇ (ath vaje)"],
        correct: "b",
      },
      {
        gurmukhi: "ਮੈਂ ਕੰਮ 'ਤੇ ਕਿਵੇਂ ਜਾਂਦਾ ਹਾਂ?",
        romanised: "Mai kaam te kiven jaanda haa?",
        options: ["ਕਾਰ (car)", "ਬੱਸ (bus)", "ਪੈਦਲ (paidal)", "ਟ੍ਰੇਨ (train)"],
        correct: "b",
      },
      {
        gurmukhi: "ਮੈਂ ਰਾਤ ਨੂੰ ਕਦੋਂ ਸੌਂਦਾ ਹਾਂ?",
        romanised: "Mai raat nu kadon saunda haa?",
        options: ["ਨੌਂ ਵਜੇ (naun vaje)", "ਦਸ ਵਜੇ (das vaje)", "ਗਿਆਰਾਂ ਵਜੇ (giaraan vaje)", "ਬਾਰਹ ਵਜੇ (barah vaje)"],
        correct: "b",
      },
    ],
  },
];

function questionText(row: QuestionRow): string {
  return `${row.gurmukhi} (${row.romanised})`;
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  console.log(`Seeding ${SCRIPTS.length} comprehension scripts (${BATCH_ID})${dryRun ? " [dry run]" : ""}…`);

  for (const script of SCRIPTS) {
    console.log(`\n→ ${script.title}`);

    if (dryRun) {
      console.log(`  ${script.sentences.length} sentences, ${script.questions.length} questions`);
      continue;
    }

    const { data: existing } = await supabase
      .from("comprehension_scripts")
      .select("id")
      .eq("title", script.title)
      .maybeSingle();

    if (existing?.id) {
      const { error: deleteError } = await supabase
        .from("comprehension_scripts")
        .delete()
        .eq("id", existing.id);
      if (deleteError) {
        console.error(`  Failed to replace existing script: ${deleteError.message}`);
        process.exit(1);
      }
      console.log("  Replaced existing script with same title");
    }

    const { data: scriptRow, error: scriptError } = await supabase
      .from("comprehension_scripts")
      .insert({
        title: script.title,
        description: script.description,
        tier: "short",
        difficulty: script.difficulty,
        display_order: script.displayOrder,
        active: true,
        needs_rewrite: false,
      })
      .select("id")
      .single();

    if (scriptError || !scriptRow) {
      console.error(`  Script insert failed: ${scriptError?.message ?? "unknown"}`);
      process.exit(1);
    }

    const scriptId = scriptRow.id as string;

    const { data: paragraphRow, error: paragraphError } = await supabase
      .from("comprehension_paragraphs")
      .insert({ script_id: scriptId, sequence_order: 1 })
      .select("id")
      .single();

    if (paragraphError || !paragraphRow) {
      console.error(`  Paragraph insert failed: ${paragraphError?.message ?? "unknown"}`);
      process.exit(1);
    }

    const paragraphId = paragraphRow.id as string;

    const sentenceRows = script.sentences.map((sentence, index) => ({
      script_id: scriptId,
      paragraph_id: paragraphId,
      sequence_order: index + 1,
      gurmukhi_text: sentence.gurmukhi,
      romanised_text: sentence.romanised,
      english_translation: sentence.english,
    }));

    const { error: sentencesError } = await supabase.from("comprehension_sentences").insert(sentenceRows);
    if (sentencesError) {
      console.error(`  Sentences insert failed: ${sentencesError.message}`);
      process.exit(1);
    }

    const questionRows = script.questions.map((question, index) => ({
      script_id: scriptId,
      question_text: questionText(question),
      option_a: question.options[0],
      option_b: question.options[1],
      option_c: question.options[2],
      option_d: question.options[3],
      correct_option: question.correct,
      sequence_order: index,
    }));

    const { error: questionsError } = await supabase.from("comprehension_questions").insert(questionRows);
    if (questionsError) {
      console.error(`  Questions insert failed: ${questionsError.message}`);
      process.exit(1);
    }

    console.log(`  ✓ ${script.sentences.length} sentences, ${script.questions.length} questions`);
  }

  console.log("\nDone. Generate audio per sentence in Content → Games → Comprehension.");
}

void main();
