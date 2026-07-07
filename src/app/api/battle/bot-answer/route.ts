import { NextResponse } from "next/server";
import { adaptBotSkill, decideBotAnswer } from "@/lib/battle/bot-opponent";
import { resolveBattleRoundIfReady } from "@/lib/battle/round-lifecycle";
import { loadBattleRound, loadBattleSession } from "@/lib/battle/load-battle";
import type { BattleQuestionPayload } from "@/lib/battle/types";
import { loadOnboardingProfile } from "@/lib/progression/load-user-progression";
import { createClient } from "@/lib/supabase/server";

type BotAnswerBody = {
  session_id?: string;
  round_number?: number;
};

export async function POST(request: Request) {
  let body: BotAnswerBody;

  try {
    body = (await request.json()) as BotAnswerBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sessionId = body.session_id?.trim();
  const roundNumber = body.round_number;

  if (!sessionId || typeof roundNumber !== "number") {
    return NextResponse.json({ error: "Missing session_id or round_number." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const session = await loadBattleSession(supabase, sessionId);
  if (!session || session.status !== "active" || !session.is_bot_opponent) {
    return NextResponse.json({ error: "Computer battle is not active." }, { status: 400 });
  }

  if (session.player_one_id !== user.id) {
    return NextResponse.json({ error: "Not a player in this battle." }, { status: 403 });
  }

  const round = await loadBattleRound(supabase, sessionId, roundNumber);
  if (!round || round.resolved_at || !round.round_active_at) {
    return NextResponse.json({ error: "Round not available." }, { status: 400 });
  }

  if (round.player_two_answered_at) {
    return NextResponse.json({ recorded: false, already_answered: true });
  }

  const skill = session.bot_skill ?? 0.55;
  const question = round.question_payload as BattleQuestionPayload;
  const botAnswer = decideBotAnswer(question, skill);

  const { data: recordData, error: recordError } = await supabase.rpc("battle_record_bot_answer", {
    p_session_id: sessionId,
    p_round_number: roundNumber,
    p_answer: botAnswer.answer,
    p_correct: botAnswer.correct,
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

    const updatedRound = resolution.round ?? round;
    if (updatedRound.player_one_answered_at) {
      const nextSkill = adaptBotSkill(skill, updatedRound.player_one_correct === true);
      await supabase.rpc("battle_update_bot_skill", {
        p_session_id: sessionId,
        p_bot_skill: nextSkill,
      });
    }

    return NextResponse.json({
      recorded: true,
      correct: botAnswer.correct,
      resolved: resolution.resolved,
      resolution: resolution.resolution ?? null,
      session: resolution.session ?? null,
      round: resolution.round ?? null,
    });
  }

  return NextResponse.json({ recorded: true, correct: botAnswer.correct, resolved: false });
}
