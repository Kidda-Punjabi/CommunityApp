import { NextResponse } from "next/server";
import { resolveBattleRoundIfReady } from "@/lib/battle/round-lifecycle";
import { loadBattleRound, loadBattleSession } from "@/lib/battle/load-battle";
import { canResolveRound } from "@/lib/battle/resolve-round";
import { loadOnboardingProfile } from "@/lib/progression/load-user-progression";
import { createClient } from "@/lib/supabase/server";

type ResolveBody = {
  session_id?: string;
  round_number?: number;
};

export async function POST(request: Request) {
  let body: ResolveBody;

  try {
    body = (await request.json()) as ResolveBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sessionId = body.session_id?.trim();
  const roundNumber = body.round_number;

  if (!sessionId || !roundNumber) {
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
  if (!session || session.status !== "active") {
    return NextResponse.json({ error: "Battle is not active." }, { status: 400 });
  }

  if (user.id !== session.player_one_id && user.id !== session.player_two_id) {
    return NextResponse.json({ error: "Not a player in this battle." }, { status: 403 });
  }

  const round = await loadBattleRound(supabase, sessionId, roundNumber);
  if (!round) {
    return NextResponse.json({ error: "Round not found." }, { status: 404 });
  }

  if (!canResolveRound(round)) {
    return NextResponse.json({ resolved: false, ready: false });
  }

  const progression = await loadOnboardingProfile(supabase, user.id);
  const resolution = await resolveBattleRoundIfReady(
    supabase,
    sessionId,
    roundNumber,
    progression.learnerLevel
  );

  return NextResponse.json({
    resolved: resolution.resolved,
    alreadyResolved: resolution.alreadyResolved ?? false,
    resolution: resolution.resolution ?? null,
    session: resolution.session ?? null,
    round: resolution.round ?? null,
  });
}
