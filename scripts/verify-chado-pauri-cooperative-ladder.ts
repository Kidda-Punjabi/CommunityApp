/**
 * E2E QA: cooperative Chado Pauri group ladder (requires migration applied).
 * npx tsx scripts/verify-chado-pauri-cooperative-ladder.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
  console.error("Missing Supabase env");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

type TestUser = { id: string; email: string; password: string; client: SupabaseClient };

async function createTestUser(tag: string, n: number): Promise<TestUser> {
  const email = `${tag}-p${n}-${Date.now()}@kidda-test.invalid`;
  const password = `Tmp-${Math.random().toString(36).slice(2)}!9Aa`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  await admin.from("profiles").upsert({ id: data.user.id });
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr) throw new Error(signErr.message);
  return { id: data.user.id, email, password, client };
}

async function cleanup(users: TestUser[], roomId: string | null) {
  if (roomId) {
    await admin.from("game_rooms").delete().eq("id", roomId);
  }
  for (const u of users) {
    await admin.auth.admin.deleteUser(u.id);
  }
}

function minimalQuestion() {
  return {
    flashcard_id: "00000000-0000-4000-8000-000000000099",
    prompt: "QA test prompt",
    correct_answer: "ਠੀਕ",
    options: ["ਠੀਕ", "ਗਲਤ", "ਹੋਰ", "ਕੁਝ"],
    category: "vocab",
    topic_tags: [],
  };
}

async function main() {
  const tag = `coop-ladder-${Date.now()}`;
  const users: TestUser[] = [];
  let roomId: string | null = null;

  try {
    const host = await createTestUser(tag, 1);
    const p2 = await createTestUser(tag, 2);
    const p3 = await createTestUser(tag, 3);
    users.push(host, p2, p3);

    const { data: created, error: createErr } = await host.client.rpc("create_game_room", {
      p_game_type: "chado_pauri_group",
      p_settings: { question_count: 10 },
    });
    if (createErr) throw new Error(`create_game_room: ${createErr.message}`);
    roomId = (created as { room_id: string }).room_id;

    for (const u of [p2, p3]) {
      const { error } = await u.client.rpc("join_game_room", {
        p_join_code: (created as { join_code: string }).join_code,
      });
      if (error) throw new Error(`join: ${error.message}`);
    }

    await admin
      .from("game_room_participants")
      .update({ is_playing: true })
      .eq("room_id", roomId);

    const { error: startErr } = await host.client.rpc("start_game_room", { p_room_id: roomId });
    if (startErr) throw new Error(`start: ${startErr.message}`);

    const q = minimalQuestion();
    const { data: initData, error: initErr } = await host.client.rpc("ladder_initialize_game", {
      p_room_id: roomId,
      p_first_question: q,
    });
    if (initErr) throw new Error(`init: ${initErr.message}`);

    const { data: runs } = await admin
      .from("game_room_ladder_runs")
      .select("id, status, player_id")
      .eq("room_id", roomId);

    if ((runs?.length ?? 0) !== 1) {
      throw new Error(
        `Expected 1 cooperative run, got ${runs?.length ?? 0} — apply chado-pauri-cooperative-ladder.sql`
      );
    }
    console.log("✓ Cooperative init: single shared run");

    const { data: room } = await admin.from("game_rooms").select("current_picker_id, settings").eq("id", roomId).single();
    const turnOrder = (room?.settings as { ladder_turn_order?: string[] })?.ladder_turn_order ?? [];
    if (turnOrder.length !== 3) throw new Error(`Expected turn order length 3, got ${turnOrder.length}`);
    if (room?.current_picker_id !== host.id) throw new Error("First picker should be host (joined first playing)");
    console.log("✓ Turn order frozen, first hot seat set");

    const runId = runs![0]!.id;
    const { data: question } = await admin
      .from("game_room_ladder_questions")
      .select("id")
      .eq("run_id", runId)
      .eq("rung", 1)
      .single();

    const questionId = question!.id as string;

    // Lifelines: half, tutor, ask room x3
    const { error: hhErr } = await host.client.rpc("use_half_half", { p_question_id: questionId });
    if (hhErr) throw new Error(`half_half: ${hhErr.message}`);
    const { error: hh2Err } = await host.client.rpc("use_half_half", { p_question_id: questionId });
    if (!hh2Err) throw new Error("half_half should be blocked on second use");
    console.log("✓ Half & Half once per game");

    const { error: tutErr } = await host.client.rpc("use_ask_tutor", { p_question_id: questionId });
    if (tutErr) throw new Error(`ask_tutor: ${tutErr.message}`);
    const { error: tut2Err } = await host.client.rpc("use_ask_tutor", { p_question_id: questionId });
    if (!tut2Err) throw new Error("ask_tutor should be blocked on second use");
    console.log("✓ Ask the Tutor once per game");

    const { error: ar1Err } = await host.client.rpc("use_ask_room", { p_question_id: questionId });
    if (ar1Err) throw new Error(`ask_room 1: ${ar1Err.message}`);
    const { error: arDupErr } = await host.client.rpc("use_ask_room", { p_question_id: questionId });
    if (!arDupErr) throw new Error("ask_room should not run twice on same question");
    const { data: roomUses } = await admin.from("game_rooms").select("settings").eq("id", roomId).single();
    const uses = (roomUses?.settings as { ladder_ask_room_uses?: number })?.ladder_ask_room_uses ?? 0;
    if (uses !== 1) throw new Error(`Expected 1 ask_room use in settings, got ${uses}`);
    console.log("✓ Ask the Room (per-question + room pool counter)");

    // Correct answer → rotate hot seat to p2
    const { data: ans1, error: ans1Err } = await host.client.rpc("submit_ladder_answer", {
      p_question_id: questionId,
      p_answer: "ਠੀਕ",
    });
    if (ans1Err) throw new Error(`answer correct: ${ans1Err.message}`);
    const a1 = ans1 as { correct?: boolean; run_completed?: boolean; current_picker_id?: string };
    if (!a1.correct || a1.run_completed) throw new Error(`unexpected answer payload: ${JSON.stringify(a1)}`);

    const { data: roomAfter } = await admin
      .from("game_rooms")
      .select("current_picker_id")
      .eq("id", roomId)
      .single();
    if (roomAfter?.current_picker_id !== p2.id) {
      throw new Error(`Hot seat should rotate to player 2, got ${roomAfter?.current_picker_id}`);
    }
    console.log("✓ Hot seat rotates after correct answer");

    // Add rung 2 question for wrong-answer game test (new room)
    await cleanup(users, roomId);
    users.length = 0;
    roomId = null;

    const host2 = await createTestUser(tag, 10);
    const guest = await createTestUser(tag, 11);
    users.push(host2, guest);

    const { data: c2 } = await host2.client.rpc("create_game_room", {
      p_game_type: "chado_pauri_group",
      p_settings: {},
    });
    roomId = (c2 as { room_id: string }).room_id;
    await guest.client.rpc("join_game_room", { p_join_code: (c2 as { join_code: string }).join_code });
    await admin.from("game_room_participants").update({ is_playing: true }).eq("room_id", roomId);
    await host2.client.rpc("start_game_room", { p_room_id: roomId });
    await host2.client.rpc("ladder_initialize_game", { p_room_id: roomId, p_first_question: q });

    const { data: qrow } = await admin
      .from("game_room_ladder_questions")
      .select("id")
      .eq("rung", 1)
      .limit(1)
      .single();

    const { data: wrongAns, error: wrongErr } = await host2.client.rpc("submit_ladder_answer", {
      p_question_id: qrow!.id,
      p_answer: "ਗਲਤ",
    });
    if (wrongErr) throw new Error(`wrong answer: ${wrongErr.message}`);
    const w = wrongAns as { correct?: boolean; game_completed?: boolean; final_score?: number };
    if (w.correct || !w.game_completed) throw new Error(`wrong path: ${JSON.stringify(w)}`);

    const { data: scores } = await admin
      .from("game_room_participants")
      .select("user_id, score")
      .eq("room_id", roomId)
      .eq("is_playing", true);
    const unique = new Set((scores ?? []).map((s) => s.score));
    if (unique.size !== 1) throw new Error(`Scores should match: ${JSON.stringify(scores)}`);
    console.log(`✓ Wrong answer ends game; all players score ${[...unique][0]}`);

    console.log("\nCooperative ladder QA passed.");
  } finally {
    await cleanup(users, roomId);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
