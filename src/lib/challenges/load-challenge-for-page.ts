import { toChallengePlayContext } from "@/lib/challenges/game-props";
import {
  loadChallengeFromSearchParams,
  resolveChallengePlayAccess,
} from "@/lib/challenges/resolve-challenge-play";
import { createClient } from "@/lib/supabase/server";

export async function loadChallengeForGamePage(
  searchParams: Promise<{ challenge?: string }>
) {
  const { challenge: challengeId } = await searchParams;
  if (!challengeId) return null;

  const supabase = await createClient();
  const challenge = await loadChallengeFromSearchParams(supabase, challengeId);
  await resolveChallengePlayAccess(challenge, challengeId);

  return challenge ? toChallengePlayContext(challenge) : null;
}
