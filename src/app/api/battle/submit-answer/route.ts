import { NextResponse } from "next/server";
import { isAnswerCorrect } from "@/lib/battle/questions";
import { resolveBattleRoundIfReady } from "@/lib/battle/round-lifecycle";
import { loadBattleRound, loadBattleSession } from "@/lib/battle/load-battle";
import type { BattleQuestionPayload } from "@/lib/battle/types";
import { loadOnboardingProfile } from "@/lib/progression/load-user-progression";
import { createClient } from "@/lib/supabase/server";

type SubmitBody = {
  session_id?: string;
  round_number?: number;
  answer?: string;
};

export async function POST(request: Request) {
  let body: SubmitBody;

  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sessionId = body.session_id?.trim();
  const roundNumber = body.round_number;
  const answer = body.answer?.trim();

  if (!sessionId || !roundNumber || !answer) {
    return NextResponse.json({ error: "Missing session_id, round_number, or answer." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const session = await loadBattleSession(supabase, sessionId);
  if (!session || session.status !== "active") {
    return NextResponse.json({ error: "Battle is not active." }, { status: 400 });
  }

  if (user.id !== session.player_one_id && user.id !== session.player_two_id) {
    return NextResponse.json({ error: "Not a player in this battle." }, { status: 403 });
  }

  const round = await loadBattleRound(supabase, sessionId, roundNumber);
  if (!round || round.resolved_at) {
    return NextResponse.json({ error: "Round not available." }, { status: 400 });
  }

  const question = round.question_payload as BattleQuestionPayload;
  const correct = isAnswerCorrect(question, answer);

  const { data: recordData, error: recordError } = await supabase.rpc("battle_record_answer", {
    p_session_id: sessionId,
    p_round_number: roundNumber,
    p_answer: answer,
    p_correct: correct,
  });

  if (recordError) {
    return NextResponse.json({ error: recordError.message }, { status: 400 });
  }

  const record = recordData as { both_answered: boolean };
  const progression = await loadOnboardingProfile(supabase, user.id);

  if (record.both_answered) {
    const resolution = await resolveBattleRoundIfReady(
      supabase,
      sessionId,
      roundNumber,
      progression.learnerLevel
    );
    return NextResponse.json({
      recorded: true,
      correct,
      resolved: resolution.resolved,
      resolution: resolution.resolution ?? null,
      session: resolution.session ?? null,
      round: resolution.round ?? null,
    });
  }

  return NextResponse.json({ recorded: true, correct, resolved: false });
}
