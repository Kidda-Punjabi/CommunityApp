/**
 * D10 verification: record_level_test_attempt grades from DB, not client counts.
 *
 * Usage: npx tsx scripts/verify-level-test-server-grade.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const p = resolve(".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) {
      process.env[k] = t
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !anonKey || !serviceKey) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

type QuestionRow = {
  id: string;
  from_level: number;
  question_type: string;
  content: Record<string, unknown> | null;
  correct_answer: string | null;
  option_a: string | null;
};

function correctPayloadForQuestion(q: QuestionRow): Record<string, unknown> {
  const content = q.content ?? {};
  if (q.question_type === "mcq" && content.correct_index != null) {
    return { question_id: q.id, selected_index: content.correct_index };
  }
  if (q.question_type === "conjugation_fill_blank" && content.target_verb_gurmukhi) {
    return { question_id: q.id, selected_gurmukhi: content.target_verb_gurmukhi };
  }
  if (q.question_type === "sentence_builder" && Array.isArray(content.word_tiles)) {
    const tiles = (content.word_tiles as { gurmukhi?: string }[])
      .map((t) => (t.gurmukhi ?? "").trim())
      .filter(Boolean);
    return { question_id: q.id, selected_tiles: tiles };
  }
  if (q.correct_answer) {
    return { question_id: q.id, selected_option: q.correct_answer };
  }
  return { question_id: q.id, selected_index: 0 };
}

function wrongPayloadForQuestion(q: QuestionRow): Record<string, unknown> {
  const content = q.content ?? {};
  if (q.question_type === "mcq" && content.correct_index != null) {
    const correct = Number(content.correct_index);
    const wrong = correct === 0 ? 1 : 0;
    return {
      question_id: q.id,
      selected_index: wrong,
      forged_score_claim: 100,
      is_correct: true,
    };
  }
  if (q.question_type === "conjugation_fill_blank") {
    return { question_id: q.id, selected_gurmukhi: "ੳ", is_correct: true };
  }
  if (q.question_type === "sentence_builder") {
    return { question_id: q.id, selected_tiles: ["wrong"], is_correct: true };
  }
  if (q.correct_answer) {
    const letters = ["a", "b", "c", "d"];
    const wrong = letters.find((l) => l !== q.correct_answer!.toLowerCase()) ?? "a";
    return { question_id: q.id, selected_option: wrong, is_correct: true };
  }
  return { question_id: q.id, selected_index: 99, is_correct: true };
}

async function main() {
  const tag = `d10-verify-${Date.now()}`;
  const email = `${tag}@kidda-test.invalid`;
  const password = `Tmp-${Math.random().toString(36).slice(2)}!9Aa`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    console.error("createUser failed:", createErr?.message);
    process.exit(1);
  }
  const userId = created.user.id;

  const authed = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInErr } = await authed.auth.signInWithPassword({ email, password });
  if (signInErr) {
    console.error("signIn failed:", signInErr.message);
    await admin.auth.admin.deleteUser(userId);
    process.exit(1);
  }

  await admin.from("profiles").upsert({
    id: userId,
    learner_level: 1,
    placement_completed: true,
    total_xp: 0,
    xp_at_level_start: 0,
  });

  const fromLevel = 1;
  const { data: questions, error: qErr } = await admin
    .from("level_test_questions")
    .select("id, from_level, question_type, content, correct_answer, option_a")
    .eq("from_level", fromLevel)
    .eq("active", true)
    .order("question_order", { ascending: true });

  if (qErr || !questions?.length) {
    console.error("No questions:", qErr?.message);
    await admin.auth.admin.deleteUser(userId);
    process.exit(1);
  }

  const expectedCount = Math.min(30, questions.length);
  const slice = questions.slice(0, expectedCount) as QuestionRow[];

  console.log(`Throwaway user ${userId} (${email}), from_level=${fromLevel}, expected answers=${expectedCount}`);

  const rpc = (answers: unknown[]) =>
    authed.rpc("record_level_test_attempt", {
      p_from_level: fromLevel,
      p_answers: answers,
      p_is_placement: true,
      p_set_level_on_pass: false,
    });

  // 1) Shortened payload — old exploit path (claim high score with few answers)
  {
    const short = slice.slice(0, 5).map((q) => wrongPayloadForQuestion(q));
    const { error } = await rpc(short);
    const ok = Boolean(error?.message?.includes("Invalid answer count"));
    console.log(ok ? "✓ Rejects shortened answer set" : `✗ Short set: ${error?.message ?? "unexpected success"}`);
    if (!ok) process.exitCode = 1;
  }

  // 2) Fake question IDs
  {
    const fake = slice.map(() => ({
      question_id: "00000000-0000-4000-8000-000000000001",
      selected_index: 0,
      is_correct: true,
    }));
    const { error } = await rpc(fake);
    const ok =
      Boolean(error?.message?.includes("Unknown or inactive")) ||
      Boolean(error?.message?.includes("Duplicate question"));
    console.log(ok ? "✓ Rejects fake question_id(s)" : `✗ Fake ids: ${error?.message ?? "unexpected success"}`);
    if (!ok) process.exitCode = 1;
  }

  // 3) All wrong but forged is_correct / score fields — server must grade low
  {
    const forged = slice.map((q) => wrongPayloadForQuestion(q));
    const { data, error } = await rpc(forged);
    if (error) {
      console.error("✗ Forged-wrong RPC failed:", error.message);
      process.exitCode = 1;
    } else {
      const r = data as { score_pct: number; passed: boolean; correct_count: number; total_count: number };
      const ok = r.correct_count < expectedCount && !r.passed && r.score_pct < 95;
      console.log(
        ok
          ? `✓ Forged is_correct ignored — scored ${r.correct_count}/${r.total_count} (${r.score_pct}%)`
          : `✗ Forged answers passed or scored too high: ${JSON.stringify(r)}`
      );
      if (!ok) process.exitCode = 1;
    }
  }

  // 4) Correct answers from DB (service role read) — proves server grades content
  {
    const honest = slice.map((q) => correctPayloadForQuestion(q));
    const { data, error } = await rpc(honest);
    if (error) {
      console.error("✗ Honest RPC failed:", error.message);
      process.exitCode = 1;
    } else {
      const r = data as { score_pct: number; passed: boolean; correct_count: number };
      const ok = r.correct_count === expectedCount && r.score_pct >= 95 && r.passed;
      console.log(
        ok
          ? `✓ Server grades from question rows — ${r.correct_count}/${expectedCount} (${r.score_pct}%)`
          : `✗ Honest answers under-scored: ${JSON.stringify(r)}`
      );
      if (!ok) process.exitCode = 1;
    }
  }

  // 5) Legacy signature should not exist (client-trusted counts)
  {
    const { error } = await authed.rpc("record_level_test_attempt", {
      p_from_level: fromLevel,
      p_correct_count: 30,
      p_total_count: 30,
      p_is_placement: true,
      p_set_level_on_pass: false,
    } as Record<string, unknown>);
    const ok = Boolean(error);
    console.log(
      ok
        ? `✓ Legacy p_correct_count/p_total_count RPC not accepted (${error?.code ?? "error"})`
        : "✗ Legacy count-only RPC still callable"
    );
    if (!ok) process.exitCode = 1;
  }

  await admin.from("level_test_attempts").delete().eq("user_id", userId);
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    console.error("Cleanup deleteUser failed:", delErr.message);
    process.exitCode = 1;
  } else {
    console.log("✓ Throwaway user and attempts removed");
  }

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
  console.log("\nD10: server-side grading verified.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
