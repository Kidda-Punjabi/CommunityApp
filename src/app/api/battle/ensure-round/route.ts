import { NextResponse } from "next/server";
import { ensureCurrentBattleRound } from "@/lib/battle/round-lifecycle";
import { loadBattleSession } from "@/lib/battle/load-battle";
import { loadOnboardingProfile } from "@/lib/progression/load-user-progression";
import { createClient } from "@/lib/supabase/server";

type EnsureBody = {
  session_id?: string;
};

export async function POST(request: Request) {
  let body: EnsureBody;

  try {
    body = (await request.json()) as EnsureBody;
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

  if (user.id !== session.player_one_id && user.id !== session.player_two_id) {
    return NextResponse.json({ error: "Not a player in this battle." }, { status: 403 });
  }

  const progression = await loadOnboardingProfile(supabase, user.id);
  const round = await ensureCurrentBattleRound(
    supabase,
    sessionId,
    progression.learnerLevel
  );

  return NextResponse.json({ round });
}
