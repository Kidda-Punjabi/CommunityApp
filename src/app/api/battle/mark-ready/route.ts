import { NextResponse } from "next/server";
import { loadBattleRound, loadBattleSession } from "@/lib/battle/load-battle";
import { createClient } from "@/lib/supabase/server";

type MarkReadyBody = {
  session_id?: string;
  round_number?: number;
};

export async function POST(request: Request) {
  let body: MarkReadyBody;

  try {
    body = (await request.json()) as MarkReadyBody;
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
  if (!session) {
    return NextResponse.json({ error: "Battle not found." }, { status: 404 });
  }

  if (user.id !== session.player_one_id && user.id !== session.player_two_id) {
    return NextResponse.json({ error: "Not a player in this battle." }, { status: 403 });
  }

  const { data, error } = await supabase.rpc("battle_mark_round_ready", {
    p_session_id: sessionId,
    p_round_number: roundNumber,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const payload = data as { round?: unknown; both_ready?: boolean };
  const round = payload.round
    ? await loadBattleRound(supabase, sessionId, roundNumber)
    : null;

  return NextResponse.json({
    round,
    both_ready: payload.both_ready ?? false,
  });
}
