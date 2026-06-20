import { gameTitleForType } from "@/lib/challenges/config";
import type { ChallengePlayContext } from "@/lib/challenges/types";
import type { GameType } from "@/lib/games/types";

type ChallengeModeBannerProps = {
  challenge: ChallengePlayContext;
  gameType: GameType;
};

export function ChallengeModeBanner({ challenge, gameType }: ChallengeModeBannerProps) {
  const gameTitle = gameTitleForType(gameType);

  return (
    <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
        Friend challenge
      </p>
      <p className="mt-1 text-sm text-violet-900">
        {challenge.role === "challenger" ? (
          <>
            Beat your own best run — <span className="font-semibold">{challenge.opponentDisplayName}</span>{" "}
            will try to top your score.
          </>
        ) : (
          <>
            <span className="font-semibold">{challenge.opponentDisplayName}</span> challenged you
            — match or beat their score!
          </>
        )}
      </p>
    </div>
  );
}
