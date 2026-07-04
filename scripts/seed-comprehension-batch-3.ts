/**
 * Seed Comprehension Practice scripts (Batch 3 — Short tier).
 *
 * This is a Node script — do NOT paste into Supabase SQL Editor.
 * For SQL Editor use: supabase/comprehension-short-tier-seed-batch-3.sql
 *
 * Usage:
 *   npx tsx scripts/seed-comprehension-batch-3.ts
 *   npx tsx scripts/seed-comprehension-batch-3.ts --dry-run
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

const BATCH_ID = "comprehension-batch-3-short";

const SCRIPTS: ScriptSeed[] = [
  {
    title: "Describing your home",
    description:
      "Draft — pending native speaker review. Present-tense home description. Access: free.",
    difficulty: 2,
    displayOrder: 7,
    sentences: [
      {
        gurmukhi: "ਮੇਰਾ ਘਰ ਛੋਟਾ ਪਰ ਸੋਹਣਾ ਹੈ।",
        romanised: "Mera ghar chota par sohna hai.",
        english: "My home is small but beautiful.",
      },
      {
        gurmukhi: "ਇਸ ਵਿੱਚ ਤਿੰਨ ਕਮਰੇ ਹਨ।",
        romanised: "Is vich tinn kamre han.",
        english: "It has three rooms.",
      },
      {
        gurmukhi: "ਰਸੋਈ ਬਹੁਤ ਵੱਡੀ ਹੈ।",
        romanised: "Rasoi bahut vaddi hai.",
        english: "The kitchen is very big.",
      },
      {
        gurmukhi: "ਸਾਡੇ ਘਰ ਦੇ ਬਾਹਰ ਇੱਕ ਬਗੀਚਾ ਹੈ।",
        romanised: "Saade ghar de bahar ik bagicha hai.",
        english: "There's a garden outside our house.",
      },
      {
        gurmukhi: "ਮੈਨੂੰ ਆਪਣਾ ਘਰ ਬਹੁਤ ਪਸੰਦ ਹੈ।",
        romanised: "Mainu apna ghar bahut pasand hai.",
        english: "I like my home a lot.",
      },
    ],
    questions: [
      {
        gurmukhi: "ਘਰ ਵਿੱਚ ਕਿੰਨੇ ਕਮਰੇ ਹਨ?",
        romanised: "Ghar vich kinne kamre han?",
        options: ["ਦੋ (do)", "ਤਿੰਨ (tinn)", "ਚਾਰ (chaar)", "ਪੰਜ (panj)"],
        correct: "b",
      },
      {
        gurmukhi: "ਕਿਹੜਾ ਕਮਰਾ ਵੱਡਾ ਹੈ?",
        romanised: "Kihra kamra vadda hai?",
        options: ["ਬੈੱਡਰੂਮ (bedroom)", "ਰਸੋਈ (rasoi)", "ਬਾਥਰੂਮ (bathroom)", "ਲਿਵਿੰਗ ਰੂਮ (living room)"],
        correct: "b",
      },
      {
        gurmukhi: "ਘਰ ਦੇ ਬਾਹਰ ਕੀ ਹੈ?",
        romanised: "Ghar de bahar ki hai?",
        options: ["ਗੈਰਾਜ (garage)", "ਬਗੀਚਾ (bagicha)", "ਪਾਰਕਿੰਗ (parking)", "ਪੁਲ (pool)"],
        correct: "b",
      },
    ],
  },
  {
    title: "Talking about a pet",
    description:
      "Draft — pending native speaker review. Present-tense pet description. Access: free.",
    difficulty: 2,
    displayOrder: 8,
    sentences: [
      {
        gurmukhi: "ਮੇਰੇ ਕੋਲ ਇੱਕ ਕੁੱਤਾ ਹੈ।",
        romanised: "Mere kol ik kutta hai.",
        english: "I have a dog.",
      },
      {
        gurmukhi: "ਉਸਦਾ ਨਾਂ ਸ਼ੇਰੂ ਹੈ।",
        romanised: "Usda naa Sheru hai.",
        english: "His name is Sheru.",
      },
      {
        gurmukhi: "ਉਹ ਬਹੁਤ ਖੇਡਣਾ ਪਸੰਦ ਕਰਦਾ ਹੈ।",
        romanised: "Oh bahut khedna pasand karda hai.",
        english: "He likes to play a lot.",
      },
      {
        gurmukhi: "ਮੈਂ ਹਰ ਰੋਜ਼ ਉਸਨੂੰ ਸੈਰ 'ਤੇ ਲੈ ਜਾਂਦਾ ਹਾਂ।",
        romanised: "Mai har roz usnu sair te lai jaanda haa.",
        english: "I take him for a walk every day.",
      },
      {
        gurmukhi: "ਸ਼ੇਰੂ ਮੇਰੇ ਪਰਿਵਾਰ ਦਾ ਹਿੱਸਾ ਹੈ।",
        romanised: "Sheru mere parivar da hissa hai.",
        english: "Sheru is part of my family.",
      },
    ],
    questions: [
      {
        gurmukhi: "ਕੁੱਤੇ ਦਾ ਨਾਂ ਕੀ ਹੈ?",
        romanised: "Kutte da naa ki hai?",
        options: ["ਟੌਮੀ (Tommy)", "ਸ਼ੇਰੂ (Sheru)", "ਮੋਤੀ (Moti)", "ਬਿੱਲੂ (Billu)"],
        correct: "b",
      },
      {
        gurmukhi: "ਸ਼ੇਰੂ ਕੀ ਪਸੰਦ ਕਰਦਾ ਹੈ?",
        romanised: "Sheru ki pasand karda hai?",
        options: ["ਸੌਣਾ (sauna)", "ਖੇਡਣਾ (khedna)", "ਖਾਣਾ (khana)", "ਸੈਰ (sair)"],
        correct: "b",
      },
      {
        gurmukhi: "ਮੈਂ ਹਰ ਰੋਜ਼ ਕੀ ਕਰਦਾ ਹਾਂ?",
        romanised: "Mai har roz ki karda haa?",
        options: [
          "ਉਸਨੂੰ ਸੈਰ 'ਤੇ ਲੈ ਜਾਂਦਾ ਹਾਂ (usnu sair te lai jaanda haa)",
          "ਉਸਨੂੰ ਨਹਾਉਂਦਾ ਹਾਂ (usnu nahaunda haa)",
          "ਉਸਨੂੰ ਸਿਖਾਉਂਦਾ ਹਾਂ (usnu sikhaunda haa)",
          "ਉਸਨੂੰ ਖਾਣਾ ਖਿਲਾਉਂਦਾ ਹਾਂ (usnu khana khilaaunda haa)",
        ],
        correct: "a",
      },
    ],
  },
  {
    title: "Asking for directions",
    description:
      "Draft — pending native speaker review. Past-tense asking for directions. Access: free.",
    difficulty: 3,
    displayOrder: 9,
    sentences: [
      {
        gurmukhi: "ਮੈਂ ਸਟੇਸ਼ਨ ਦਾ ਰਸਤਾ ਪੁੱਛਿਆ ਸੀ।",
        romanised: "Mai station da rasta puchiya si.",
        english: "I had asked the way to the station.",
      },
      {
        gurmukhi: "ਇੱਕ ਆਦਮੀ ਨੇ ਮੈਨੂੰ ਸਿੱਧਾ ਜਾਣ ਲਈ ਕਿਹਾ ਸੀ।",
        romanised: "Ik aadmi ne mainu sidha jaan lai kiha si.",
        english: "A man had told me to go straight.",
      },
      {
        gurmukhi: "ਫਿਰ ਖੱਬੇ ਪਾਸੇ ਮੁੜਨਾ ਸੀ।",
        romanised: "Phir khabbe paase murna si.",
        english: "Then I had to turn left.",
      },
      {
        gurmukhi: "ਸਟੇਸ਼ਨ ਬੈਂਕ ਦੇ ਸਾਹਮਣੇ ਸੀ।",
        romanised: "Station bank de saahmne si.",
        english: "The station was in front of the bank.",
      },
      {
        gurmukhi: "ਮੈਂ ਸਮੇਂ ਸਿਰ ਪਹੁੰਚ ਗਿਆ ਸੀ।",
        romanised: "Mai samen sir pahunch gya si.",
        english: "I had arrived on time.",
      },
    ],
    questions: [
      {
        gurmukhi: "ਮੈਂ ਕੀ ਪੁੱਛਿਆ?",
        romanised: "Mai ki puchiya?",
        options: ["ਸਮਾਂ (samaa)", "ਰਸਤਾ (rasta)", "ਕੀਮਤ (keemat)", "ਪਤਾ (pata)"],
        correct: "b",
      },
      {
        gurmukhi: "ਸਟੇਸ਼ਨ ਕਿੱਥੇ ਸੀ?",
        romanised: "Station kitthe si?",
        options: [
          "ਬੈਂਕ ਦੇ ਸਾਹਮਣੇ (bank de saahmne)",
          "ਸਕੂਲ ਦੇ ਕੋਲ (school de kol)",
          "ਬਜ਼ਾਰ ਵਿੱਚ (bazaar vich)",
          "ਹਸਪਤਾਲ ਦੇ ਪਿੱਛੇ (hspatal de pichhe)",
        ],
        correct: "a",
      },
      {
        gurmukhi: "ਮੈਂ ਕਿਵੇਂ ਪਹੁੰਚਿਆ?",
        romanised: "Mai kiven pahunchiya?",
        options: ["ਦੇਰ ਨਾਲ (der naal)", "ਸਮੇਂ ਸਿਰ (samen sir)", "ਬਹੁਤ ਜਲਦੀ (bahut jaldi)", "ਹੌਲੀ ਹੌਲੀ (hauli hauli)"],
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
