/**
 * Seed Comprehension Practice scripts (Batch 1 — Short tier).
 *
 * This is a Node script — do NOT paste into Supabase SQL Editor.
 * For SQL Editor use: supabase/comprehension-short-tier-seed-batch-1-2.sql
 *
 * Usage:
 *   npx tsx scripts/seed-comprehension-batch-1.ts
 *   npx tsx scripts/seed-comprehension-batch-1.ts --dry-run
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

const BATCH_ID = "comprehension-batch-1-short";

const SCRIPTS: ScriptSeed[] = [
  {
    title: "Meeting a friend for tea",
    description:
      "Draft — pending native speaker review. A past-tense café visit with a friend. Access: free.",
    difficulty: 2,
    displayOrder: 1,
    sentences: [
      {
        gurmukhi: "ਅੱਜ ਮੈਂ ਆਪਣੇ ਦੋਸਤ ਨੂੰ ਮਿਲਿਆ ਸੀ।",
        romanised: "Ajj mai apne dost nu miliya si.",
        english: "Today I had met my friend.",
      },
      {
        gurmukhi: "ਅਸੀਂ ਇੱਕ ਕੈਫੇ ਵਿੱਚ ਬੈਠੇ ਸੀ।",
        romanised: "Asi ik cafe vich baithe si.",
        english: "We had sat in a café.",
      },
      {
        gurmukhi: "ਉਸ ਨੇ ਚਾਹ ਮੰਗਵਾਈ ਸੀ ਅਤੇ ਮੈਂ ਕੌਫੀ।",
        romanised: "Us ne chah mangvai si ate mai coffee.",
        english: "They had ordered tea and I had coffee.",
      },
      {
        gurmukhi: "ਅਸੀਂ ਬਹੁਤ ਗੱਲਾਂ ਕੀਤੀਆਂ ਸੀ।",
        romanised: "Asi bahut gallaa kitiaa si.",
        english: "We had talked a lot.",
      },
      {
        gurmukhi: "ਸਮਾਂ ਬਹੁਤ ਜਲਦੀ ਲੰਘ ਗਿਆ ਸੀ।",
        romanised: "Samaa bahut jaldi langh gya si.",
        english: "The time had passed very quickly.",
      },
    ],
    questions: [
      {
        gurmukhi: "ਦੋਸਤ ਨੇ ਕੀ ਮੰਗਵਾਇਆ?",
        romanised: "Dost ne ki mangvaya?",
        options: ["ਚਾਹ (chah)", "ਕੌਫੀ (coffee)", "ਪਾਣੀ (pani)", "ਜੂਸ (juice)"],
        correct: "a",
      },
      {
        gurmukhi: "ਉਹ ਕਿੱਥੇ ਬੈਠੇ?",
        romanised: "Oh kitthe baithe?",
        options: ["ਘਰ (ghar)", "ਕੈਫੇ (cafe)", "ਪਾਰਕ (park)", "ਬਾਜ਼ਾਰ (bazaar)"],
        correct: "b",
      },
      {
        gurmukhi: "ਸਮਾਂ ਕਿਵੇਂ ਲੰਘਿਆ?",
        romanised: "Samaa kiven langhiya?",
        options: ["ਹੌਲੀ (hauli)", "ਜਲਦੀ (jaldi)", "ਬੋਰਿੰਗ (boring)", "ਬਹੁਤ ਲੰਬਾ (bahut lamba)"],
        correct: "b",
      },
    ],
  },
  {
    title: "Introducing your family",
    description:
      "Draft — pending native speaker review. Present-tense family introduction. Access: free.",
    difficulty: 2,
    displayOrder: 2,
    sentences: [
      {
        gurmukhi: "ਮੇਰਾ ਪਰਿਵਾਰ ਵੱਡਾ ਹੈ।",
        romanised: "Mera parivar vadda hai.",
        english: "My family is big.",
      },
      {
        gurmukhi: "ਮੇਰੇ ਮਾਤਾ-ਪਿਤਾ, ਇੱਕ ਭਰਾ ਅਤੇ ਇੱਕ ਭੈਣ ਹੈ।",
        romanised: "Mere mata-pita, ik bhara ate ik bhain hai.",
        english: "I have my parents, one brother, and one sister.",
      },
      {
        gurmukhi: "ਮੇਰੇ ਪਿਤਾ ਜੀ ਡਾਕਟਰ ਹਨ।",
        romanised: "Mere pita ji doctor han.",
        english: "My father is a doctor.",
      },
      {
        gurmukhi: "ਮੇਰੀ ਮਾਤਾ ਜੀ ਸਕੂਲ ਵਿੱਚ ਸਿਖਾਉਂਦੇ ਹਨ।",
        romanised: "Meri mata ji school vich sikhaunde han.",
        english: "My mother teaches at a school.",
      },
      {
        gurmukhi: "ਅਸੀਂ ਹਰ ਐਤਵਾਰ ਇਕੱਠੇ ਖਾਣਾ ਖਾਂਦੇ ਹਾਂ।",
        romanised: "Asi har aitvar ikatthe khana khaande haa.",
        english: "We eat together every Sunday.",
      },
    ],
    questions: [
      {
        gurmukhi: "ਪਿਤਾ ਜੀ ਕੀ ਕੰਮ ਕਰਦੇ ਹਨ?",
        romanised: "Pita ji ki kaam karde han?",
        options: ["ਡਾਕਟਰ (doctor)", "ਅਧਿਆਪਕ (adhiapak)", "ਇੰਜੀਨੀਅਰ (engineer)", "ਵਕੀਲ (vakil)"],
        correct: "a",
      },
      {
        gurmukhi: "ਮਾਤਾ ਜੀ ਕੀ ਕਰਦੇ ਹਨ?",
        romanised: "Mata ji ki karde han?",
        options: [
          "ਸਕੂਲ ਵਿੱਚ ਸਿਖਾਉਂਦੇ ਹਨ (school vich sikhaunde han)",
          "ਹਸਪਤਾਲ ਵਿੱਚ ਕੰਮ ਕਰਦੇ ਹਨ (hspatal vich kaam karde han)",
          "ਦੁਕਾਨ ਚਲਾਉਂਦੇ ਹਨ (dukan chalaunde han)",
          "ਘਰ ਵਿੱਚ ਰਹਿੰਦੇ ਹਨ (ghar vich rahinde han)",
        ],
        correct: "a",
      },
      {
        gurmukhi: "ਪਰਿਵਾਰ ਕਦੋਂ ਇਕੱਠੇ ਖਾਣਾ ਖਾਂਦਾ ਹੈ?",
        romanised: "Parivar kadon ikatthe khana khaanda hai?",
        options: ["ਸ਼ਨੀਵਾਰ (shanivar)", "ਐਤਵਾਰ (aitvar)", "ਸੋਮਵਾਰ (somvar)", "ਮੰਗਲਵਾਰ (mangalvar)"],
        correct: "b",
      },
    ],
  },
  {
    title: "Ordering food at a dhaba",
    description:
      "Draft — pending native speaker review. Past-tense visit to a roadside dhaba. Access: free.",
    difficulty: 3,
    displayOrder: 3,
    sentences: [
      {
        gurmukhi: "ਅਸੀਂ ਇੱਕ ਢਾਬੇ 'ਤੇ ਗਏ ਸੀ।",
        romanised: "Asi ik dhabe te gae si.",
        english: "We had gone to a dhaba (roadside eatery).",
      },
      {
        gurmukhi: "ਵੇਟਰ ਨੇ ਮੀਨੂ ਦਿੱਤਾ ਸੀ।",
        romanised: "Waiter ne menu ditta si.",
        english: "The waiter had given the menu.",
      },
      {
        gurmukhi: "ਮੈਂ ਦਾਲ ਅਤੇ ਰੋਟੀ ਮੰਗਵਾਈ ਸੀ।",
        romanised: "Mai daal ate roti mangvai si.",
        english: "I had ordered lentils and bread.",
      },
      {
        gurmukhi: "ਮੇਰੇ ਦੋਸਤ ਨੇ ਪਨੀਰ ਦੀ ਸਬਜ਼ੀ ਲਈ ਸੀ।",
        romanised: "Mere dost ne paneer di sabzi lai si.",
        english: "My friend had had paneer curry.",
      },
      {
        gurmukhi: "ਖਾਣਾ ਬਹੁਤ ਸੁਆਦੀ ਸੀ।",
        romanised: "Khana bahut suadi si.",
        english: "The food was very tasty.",
      },
    ],
    questions: [
      {
        gurmukhi: "ਮੈਂ ਕੀ ਮੰਗਵਾਇਆ?",
        romanised: "Mai ki mangvaya?",
        options: ["ਦਾਲ ਅਤੇ ਰੋਟੀ (daal ate roti)", "ਪਨੀਰ (paneer)", "ਚੌਲ (chaul)", "ਸਬਜ਼ੀ (sabzi)"],
        correct: "a",
      },
      {
        gurmukhi: "ਦੋਸਤ ਨੇ ਕੀ ਲਿਆ?",
        romanised: "Dost ne ki liya?",
        options: [
          "ਦਾਲ (daal)",
          "ਪਨੀਰ ਦੀ ਸਬਜ਼ੀ (paneer di sabzi)",
          "ਰੋਟੀ (roti)",
          "ਪਰਾਠਾ (paratha)",
        ],
        correct: "b",
      },
      {
        gurmukhi: "ਖਾਣਾ ਕਿਵੇਂ ਸੀ?",
        romanised: "Khana kiven si?",
        options: ["ਸੁਆਦੀ (suadi)", "ਖਰਾਬ (kharab)", "ਠੰਡਾ (thanda)", "ਗਰਮ (garam)"],
        correct: "a",
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
