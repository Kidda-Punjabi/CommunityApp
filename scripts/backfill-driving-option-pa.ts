/**
 * Backfill option_*_pa for UK Driving Theory questions that have English options
 * but missing Punjabi option text.
 *
 * Usage:
 *   npx tsx scripts/backfill-driving-option-pa.ts --dry-run
 *   npx tsx scripts/backfill-driving-option-pa.ts
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const DRIVING_COURSE_ID = "c1c48171-23a3-4d51-8026-5dc33a08b24f";

type Row = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_a_pa: string | null;
  option_b_pa: string | null;
  option_c_pa: string | null;
  option_d_pa: string | null;
};

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

async function translateOptions(row: Row): Promise<{
  a: string;
  b: string;
  c: string;
  d: string;
}> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("Missing ANTHROPIC_API_KEY");

  const prompt = `Translate these UK Driving Theory multiple-choice options into clear, natural Punjabi (Gurmukhi).
Keep numbers, units (mph, mg, ml), and proper nouns as commonly used in Punjabi learner materials.
Return ONLY valid JSON: {"a":"...","b":"...","c":"...","d":"..."} with no markdown.

Question (context): ${row.question_text}
A: ${row.option_a}
B: ${row.option_b}
C: ${row.option_c}
D: ${row.option_d}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic ${response.status}: ${(await response.text()).slice(0, 240)}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = payload.content?.find((part) => part.type === "text")?.text?.trim() ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON in response: ${text.slice(0, 160)}`);
  const parsed = JSON.parse(jsonMatch[0]) as { a?: string; b?: string; c?: string; d?: string };
  if (!parsed.a || !parsed.b || !parsed.c || !parsed.d) {
    throw new Error("Incomplete translation JSON");
  }
  return { a: parsed.a, b: parsed.b, c: parsed.c, d: parsed.d };
}

async function main() {
  loadEnvLocal();
  const dryRun = hasFlag("dry-run");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");

  const supabase = createClient(url, key);
  const { data: quizzes, error: quizError } = await supabase
    .from("quizzes")
    .select("id")
    .eq("course_id", DRIVING_COURSE_ID);
  if (quizError) throw new Error(quizError.message);

  const quizIds = (quizzes ?? []).map((q) => q.id as string);
  const rows: Row[] = [];
  for (const quizId of quizIds) {
    const { data, error } = await supabase
      .from("quiz_questions")
      .select(
        "id, question_text, option_a, option_b, option_c, option_d, option_a_pa, option_b_pa, option_c_pa, option_d_pa"
      )
      .eq("quiz_id", quizId);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const typed = row as Row;
      if (!typed.option_a_pa?.trim()) rows.push(typed);
    }
  }

  console.log(`Missing option PA: ${rows.length} (dryRun=${dryRun})`);

  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    console.log(`Translate ${row.id}: ${row.question_text.slice(0, 64)}…`);
    if (dryRun) {
      updated += 1;
      continue;
    }
    try {
      const pa = await translateOptions(row);
      const { error } = await supabase
        .from("quiz_questions")
        .update({
          option_a_pa: pa.a,
          option_b_pa: pa.b,
          option_c_pa: pa.c,
          option_d_pa: pa.d,
        })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      updated += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `FAILED ${row.id}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.log(`\nDone. updated=${updated} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
