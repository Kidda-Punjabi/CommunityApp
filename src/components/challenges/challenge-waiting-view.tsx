import Link from "next/link";
import { gameTitleForType } from "@/lib/challenges/config";
import { opponentDisplayName } from "@/lib/challenges/load-challenges";
import type { FriendGameChallenge } from "@/lib/challenges/types";
import { ui } from "@/lib/ui/styles";

type ChallengeWaitingViewProps = {
  challenge: FriendGameChallenge;
};

export function ChallengeWaitingView({ challenge }: ChallengeWaitingViewProps) {
  const gameTitle = gameTitleForType(challenge.gameType);

  return (
    <div className={`${ui.page} ${ui.stackLoose}`}>
      <Link href="/dashboard/home" className="text-sm font-medium text-violet-600">
        ← Home
      </Link>
      <div className={ui.card}>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          Challenge sent
        </p>
        <h1 className="mt-2 text-xl font-bold text-zinc-900">Waiting for {opponentDisplayName(challenge)}</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Your {gameTitle} score is{" "}
          <span className="font-semibold text-zinc-900">{challenge.challengerScore ?? 0}</span>.
          We&apos;ll notify you when they play.
        </p>
        <Link href="/dashboard/home" className={`mt-4 inline-block ${ui.btnPrimary}`}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
