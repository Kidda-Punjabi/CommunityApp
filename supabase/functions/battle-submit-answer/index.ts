import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveRoundDamage } from "../_shared/battle-scoring.ts";

const ROUND_TIMEOUT_MS = 15_000;

type SubmitBody = {
  session_id?: string;
  round_number?: number;
  answer?: string;
};

function isAnswerCorrect(payload: Record<string, unknown>, answer: string): boolean {
  const correct = String(payload.correctAnswer ?? "").trim();
  return answer.trim() === correct;
}

function isRoundTimedOut(roundStartedAt: string): boolean {
  return Date.now() - new Date(roundStartedAt).getTime() >= ROUND_TIMEOUT_MS;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const sessionId = body.session_id?.trim();
  const roundNumber = body.round_number;
  const answer = body.answer?.trim();

  if (!sessionId || !roundNumber || !answer) {
    return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  const { data: session, error: sessionError } = await supabase
    .from("battle_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !session || session.status !== "active") {
    return new Response(JSON.stringify({ error: "Battle not active" }), { status: 400 });
  }

  const { data: round, error: roundError } = await supabase
    .from("battle_rounds")
    .select("*")
    .eq("session_id", sessionId)
    .eq("round_number", roundNumber)
    .maybeSingle();

  if (roundError || !round || round.resolved_at) {
    return new Response(JSON.stringify({ error: "Round unavailable" }), { status: 400 });
  }

  const correct = isAnswerCorrect(round.question_payload as Record<string, unknown>, answer);

  const { data: recordData, error: recordError } = await supabase.rpc("battle_record_answer", {
    p_session_id: sessionId,
    p_round_number: roundNumber,
    p_answer: answer,
    p_correct: correct,
  });

  if (recordError) {
    return new Response(JSON.stringify({ error: recordError.message }), { status: 400 });
  }

  const bothAnswered = Boolean((recordData as { both_answered?: boolean })?.both_answered);
  const timedOut = isRoundTimedOut(round.round_started_at);

  if (!bothAnswered && !timedOut) {
    return new Response(JSON.stringify({ recorded: true, correct, resolved: false }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const updatedRound = (recordData as { round?: Record<string, unknown> })?.round ?? round;
  const p1Answered = updatedRound.player_one_answered_at as string | null;
  const p2Answered = updatedRound.player_two_answered_at as string | null;

  const resolution = resolveRoundDamage(
    roundNumber,
    round.round_started_at,
    {
      correct: Boolean(updatedRound.player_one_correct) && Boolean(p1Answered),
      answeredAtIso: p1Answered,
    },
    {
      correct: Boolean(updatedRound.player_two_correct) && Boolean(p2Answered),
      answeredAtIso: p2Answered,
    }
  );

  let playerOneHp = session.player_one_hp;
  let playerTwoHp = session.player_two_hp;

  if (resolution.damageRecipient === "player_one") {
    playerOneHp -= resolution.finalDamage;
  } else if (resolution.damageRecipient === "player_two") {
    playerTwoHp -= resolution.finalDamage;
  }

  let winnerId: string | null = null;
  let sessionStatus = "active";
  let startNextRound = true;

  if (playerOneHp <= 0 && session.player_two_id) {
    winnerId = session.player_two_id;
    sessionStatus = "completed";
    startNextRound = false;
  } else if (playerTwoHp <= 0) {
    winnerId = session.player_one_id;
    sessionStatus = "completed";
    startNextRound = false;
  }

  const { data: applyData, error: applyError } = await supabase.rpc("battle_apply_round_resolution", {
    p_session_id: sessionId,
    p_round_number: roundNumber,
    p_player_one_damage_dealt: resolution.playerOneDamageDealt,
    p_player_two_damage_dealt: resolution.playerTwoDamageDealt,
    p_player_one_hp: playerOneHp,
    p_player_two_hp: playerTwoHp,
    p_winner_id: winnerId,
    p_session_status: sessionStatus,
    p_start_next_round: startNextRound,
  });

  if (applyError) {
    return new Response(JSON.stringify({ error: applyError.message }), { status: 400 });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  await serviceClient.channel(`battle:${sessionId}`).send({
    type: "broadcast",
    event: "round_resolved",
    payload: applyData,
  });

  return new Response(
    JSON.stringify({
      recorded: true,
      correct,
      resolved: true,
      session: (applyData as { session?: unknown })?.session ?? null,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
