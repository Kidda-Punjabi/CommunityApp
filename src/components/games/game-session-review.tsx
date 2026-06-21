import Link from "next/link";
import { EnglishWithGenderMarkers } from "@/components/english-with-gender-markers";
import { PointsEarnedBadge } from "@/components/points/points-earned-badge";
import {
  encouragingScoreHeadline,
  missedCount,
  type RoundResult,
} from "@/lib/games/session-review";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";

type GameSessionReviewProps = {
  title: string;
  correct: number;
  total: number;
  sessionLog: RoundResult[];
  pointsEarned?: number;
  scoreSubtitle?: string;
  extraSummary?: React.ReactNode;
  onPlayAgain: () => void;
  hidePlayAgain?: boolean;
  gamesHubHref?: string;
};

function PromptLines({
  prompt,
  promptRomanised,
  className = "",
}: {
  prompt: string;
  promptRomanised?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <EnglishWithGenderMarkers
        as="p"
        text={prompt}
        className="font-medium text-zinc-900"
      />
      {promptRomanised ? (
        <p className="mt-0.5 text-sm text-violet-600">{promptRomanised}</p>
      ) : null}
    </div>
  );
}

function AnswerLines({
  label,
  gurmukhi,
  romanised,
  tone = "neutral",
}: {
  label: string;
  gurmukhi: string;
  romanised?: string;
  tone?: "neutral" | "wrong" | "correct";
}) {
  const labelClass =
    tone === "wrong"
      ? "text-red-700"
      : tone === "correct"
        ? "text-green-700"
        : "text-zinc-500";
  const textClass =
    tone === "wrong"
      ? "text-red-900"
      : tone === "correct"
        ? "text-green-900"
        : "text-zinc-900";

  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wider ${labelClass}`}>
        {label}
      </p>
      <p className={`mt-0.5 text-sm font-medium ${textClass}`}>{gurmukhi}</p>
      {romanised ? (
        <p
          className={`text-sm ${
            tone === "wrong"
              ? "text-red-600"
              : tone === "correct"
                ? "text-green-600"
                : "text-violet-600"
          }`}
        >
          {romanised}
        </p>
      ) : null}
    </div>
  );
}

function RoundReviewCard({ entry, index }: { entry: RoundResult; index: number }) {
  if (entry.wasCorrect) {
    return (
      <li className="rounded-2xl border border-green-200 bg-green-50/60 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-green-700">
              Question {index + 1}
            </p>
            <PromptLines
              prompt={entry.prompt}
              promptRomanised={entry.promptRomanised}
              className="mt-1"
            />
          </div>
          <span className="shrink-0 text-lg text-green-600" aria-label="Correct">
            ✓
          </span>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-2xl border border-red-200 bg-red-50/50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
        Question {index + 1}
      </p>
      <PromptLines
        prompt={entry.prompt}
        promptRomanised={
          entry.omitPromptRomanisedWhenIncorrect ? undefined : entry.promptRomanised
        }
        className="mt-1"
      />
      <div className="mt-3 space-y-2 border-t border-red-100 pt-3">
        <AnswerLines
          label="Your answer"
          gurmukhi={entry.userAnswer}
          romanised={entry.userAnswerRomanised}
          tone="wrong"
        />
        <AnswerLines
          label="Correct answer"
          gurmukhi={entry.correctAnswer}
          romanised={entry.correctAnswerRomanised}
          tone="correct"
        />
      </div>
    </li>
  );
}

export function GameSessionReview({
  title,
  correct,
  total,
  sessionLog,
  pointsEarned = 0,
  scoreSubtitle,
  extraSummary,
  onPlayAgain,
  hidePlayAgain = false,
  gamesHubHref = GAMES_HUB_HREF,
}: GameSessionReviewProps) {
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const validLog = sessionLog.filter((entry) => entry.prompt.trim().length > 0);
  const missed = missedCount(validLog);
  const headline = encouragingScoreHeadline(correct, total);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-violet-600">{title}</p>
        <h2 className="mt-2 text-3xl font-bold text-zinc-900">{headline}</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {scoreSubtitle ?? `${accuracy}% accuracy`}
        </p>
        {pointsEarned > 0 && <PointsEarnedBadge points={pointsEarned} className="mt-3" />}
        {extraSummary}
      </div>

      {validLog.length > 0 ? (
        <div className="space-y-3">
          {missed > 0 ? (
            <p className="text-sm font-medium text-zinc-700">
              Here&apos;s what to review — {missed} question{missed === 1 ? "" : "s"} to
              look at again.
            </p>
          ) : (
            <p className="text-sm font-medium text-zinc-700">
              You got them all — great session!
            </p>
          )}
          <ul className="space-y-3">
            {validLog.map((entry, index) => (
              <RoundReviewCard key={`${index}-${entry.prompt}`} entry={entry} index={index} />
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onPlayAgain}
        hidden={hidePlayAgain}
        className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
      >
        Play again
      </button>
      <Link
        href={gamesHubHref}
        className="block text-center text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        Go back
      </Link>
    </div>
  );
}
