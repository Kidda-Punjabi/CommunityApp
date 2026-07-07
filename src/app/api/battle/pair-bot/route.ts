import { NextResponse } from "next/server";
import { initialBotSkill } from "@/lib/battle/bot-opponent";
import { ensureCurrentBattleRound } from "@/lib/battle/round-lifecycle";
import { loadBattleSession } from "@/lib/battle/load-battle";
import { loadOnboardingProfile } from "@/lib/progression/load-user-progression";
import { createClient } from "@/lib/supabase/server";

type PairBotBody = {
  session_id?: string;
};

export async function POST(request: Request) {
  let body: PairBotBody;

  try {
    body = (await request.json()) as PairBotBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sessionId = body.session_id?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const session = await loadBattleSession(supabase, sessionId);
  if (!session) {
    return NextResponse.json({ error: "Battle not found." }, { status: 404 });
  }

  if (session.player_one_id !== user.id) {
    return NextResponse.json({ error: "Only the waiting player can pair a computer." }, { status: 403 });
  }

  if (!session.is_quick_match) {
    return NextResponse.json({ error: "Not a quick match session." }, { status: 400 });
  }

  if (session.status === "active" && (session.player_two_id || session.is_bot_opponent)) {
    return NextResponse.json({ paired: true, already_paired: true, session });
  }

  if (session.status !== "waiting") {
    return NextResponse.json({ error: "Battle is no longer waiting." }, { status: 400 });
  }

  const progression = await loadOnboardingProfile(supabase, user.id);
  const botSkill = initialBotSkill(progression.learnerLevel);

  const { data, error } = await supabase.rpc("battle_pair_bot_opponent", {
    p_session_id: sessionId,
    p_bot_skill: botSkill,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await ensureCurrentBattleRound(supabase, sessionId, progression.learnerLevel);

  const updated = await loadBattleSession(supabase, sessionId);
  const payload = data as { already_paired?: boolean };

  return NextResponse.json({
    paired: true,
    already_paired: payload.already_paired ?? false,
    session: updated,
  });
}
