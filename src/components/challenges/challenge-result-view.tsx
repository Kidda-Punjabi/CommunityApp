import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import { UserAvatar } from "@/components/profile/user-avatar";
import {
  challengerDisplayName,
  challengedDisplayName,
  opponentDisplayName,
} from "@/lib/challenges/load-challenges";
import { gameTitleForType, scoreLabelForGameType } from "@/lib/challenges/config";
import type { FriendGameChallenge } from "@/lib/challenges/types";
import { ui } from "@/lib/ui/styles";

type ChallengeResultViewProps = {
  challenge: FriendGameChallenge;
  currentUserId: string;
};

export function ChallengeResultView({ challenge, currentUserId }: ChallengeResultViewProps) {
  const gameTitle = gameTitleForType(challenge.gameType);
  const scoreLabel = scoreLabelForGameType(challenge.gameType);
  const youWon = challenge.winnerId === currentUserId;
  const youLost =
    challenge.winnerId !== null && challenge.winnerId !== currentUserId && !challenge.isTie;

  let headline = "It's a tie!";
  let subline = "Same score — great minds think alike.";
  if (!challenge.isTie && challenge.winnerId) {
    if (youWon) {
      headline = "You won! 🏆";
      subline = `You beat ${opponentDisplayName(challenge)} in ${gameTitle}.`;
    } else if (youLost) {
      headline = "They got you this time";
      subline = `${opponentDisplayName(challenge)} won the ${gameTitle} challenge.`;
    } else {
      headline = "Challenge complete";
      subline = `${gameTitle} challenge finished.`;
    }
  }

  return (
    <div className={`${ui.page} ${ui.stackLoose}`}>
      <BackLink fallbackHref="/dashboard/learn" className="text-sm font-medium text-violet-600">← Back</BackLink>

      <div className={`${ui.card} text-center`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          {gameTitle} challenge
        </p>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">{headline}</h1>
        <p className="mt-2 text-sm text-zinc-600">{subline}</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <ScoreCard
            name={challengerDisplayName(challenge)}
            profile={challenge.challenger}
            score={challenge.challengerScore}
            scoreLabel={scoreLabel}
            highlight={challenge.winnerId === challenge.challengerId}
            isYou={currentUserId === challenge.challengerId}
          />
          <ScoreCard
            name={challengedDisplayName(challenge)}
            profile={challenge.challenged}
            score={challenge.challengedScore}
            scoreLabel={scoreLabel}
            highlight={challenge.winnerId === challenge.challengedId}
            isYou={currentUserId === challenge.challengedId}
          />
        </div>

        {challenge.isTie && (
          <p className="mt-4 text-sm font-medium text-amber-700">Tied score — rematch?</p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/dashboard/challenges/new" className={ui.btnPrimary}>
            Challenge again
          </Link>
          <Link
            href="/dashboard/games"
            className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Play more games
          </Link>
        </div>
      </div>
    </div>
  );
}

function ScoreCard({
  name,
  profile,
  score,
  scoreLabel,
  highlight,
  isYou,
}: {
  name: string;
  profile: FriendGameChallenge["challenger"];
  score: number | null;
  scoreLabel: string;
  highlight: boolean;
  isYou: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-4 ${
        highlight ? "border-emerald-300 bg-emerald-50" : "border-zinc-200 bg-zinc-50"
      }`}
    >
      <UserAvatar profile={profile} size="md" />
      <p className="mt-2 text-sm font-semibold text-zinc-900">
        {name}
        {isYou && <span className="text-zinc-400"> (you)</span>}
      </p>
      <p className="mt-1 text-2xl font-bold text-zinc-900">{score ?? "—"}</p>
      <p className="text-xs text-zinc-500">{scoreLabel}</p>
      {highlight && <p className="mt-1 text-xs font-semibold text-emerald-700">Winner</p>}
    </div>
  );
}
