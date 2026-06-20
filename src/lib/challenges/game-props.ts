import type { ChallengePlayContext } from "@/lib/challenges/types";
import type { FriendGameChallenge } from "@/lib/challenges/types";
import { opponentDisplayName } from "@/lib/challenges/load-challenges";

export function toChallengePlayContext(challenge: FriendGameChallenge): ChallengePlayContext {
  return {
    id: challenge.id,
    role: challenge.yourRole,
    config: challenge.config,
    opponentDisplayName: opponentDisplayName(challenge),
    status: challenge.status,
  };
}

export type ChallengeGameProps = {
  challenge?: ChallengePlayContext | null;
};
