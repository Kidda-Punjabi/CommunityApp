import { redirect } from "next/navigation";
import {
  canPlayChallenge,
  loadFriendGameChallenge,
} from "@/lib/challenges/load-challenges";
import type { FriendGameChallenge } from "@/lib/challenges/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadChallengeFromSearchParams(
  supabase: SupabaseClient,
  challengeId: string | undefined
): Promise<FriendGameChallenge | null> {
  if (!challengeId) return null;
  return loadFriendGameChallenge(supabase, challengeId);
}

export async function resolveChallengePlayAccess(
  challenge: FriendGameChallenge | null,
  challengeId: string | undefined
): Promise<{ challenge: FriendGameChallenge | null; blocked: boolean }> {
  if (!challengeId) return { challenge: null, blocked: false };
  if (!challenge) return { challenge: null, blocked: true };

  if (challenge.status === "completed") {
    redirect(`/dashboard/challenges/${challenge.id}`);
  }

  if (
    challenge.yourRole === "challenger" &&
    challenge.status === "awaiting_friend"
  ) {
    redirect(`/dashboard/challenges/${challenge.id}/waiting`);
  }

  if (!canPlayChallenge(challenge)) {
    return { challenge, blocked: true };
  }

  return { challenge, blocked: false };
}
