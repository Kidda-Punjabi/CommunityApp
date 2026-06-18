import Link from "next/link";
import { DeckProgressBar } from "@/components/deck-progress-bar";
import {
  computeDeckConfidenceStats,
  type FlashcardProgressRow,
} from "@/lib/progress/flashcard-progress";
import type { MatchScoreRow } from "@/lib/progress/match-scores";
import type { FlashcardDeckContext } from "@/lib/flashcards/types";

type FlashcardDeckHubProps = {
  deck: FlashcardDeckContext;
  progress: FlashcardProgressRow[];
  matchScore: MatchScoreRow | null;
};

const modeCards = [
  {
    key: "study",
    href: "study",
    title: "Flashcards",
    description: "Flip cards and rate your confidence",
    emoji: "🃏",
  },
  {
    key: "match",
    href: "match",
    title: "Match",
    description: "Pair fronts and backs against the clock",
    emoji: "⚡",
  },
  {
    key: "test",
    href: "test",
    title: "Test",
    description: "Multiple choice quiz from this deck",
    emoji: "✓",
  },
] as const;

export function FlashcardDeckHub({ deck, progress, matchScore }: FlashcardDeckHubProps) {
  const progressMap = new Map(progress.map((row) => [row.flashcard_id, row]));
  const stats = computeDeckConfidenceStats(
    deck.cards.map((card) => card.id),
    progressMap
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/practice"
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back to Practice
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
          {deck.courseName} · Lesson {deck.lessonNumber}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">{deck.lessonTitle}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {deck.deckName} · {deck.cards.length} cards
        </p>
        <DeckProgressBar
          confident={stats.confident}
          notConfident={stats.notConfident}
          total={stats.total}
        />
      </div>

      {matchScore && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Match best
          </p>
          <p className="mt-1 text-lg font-bold text-zinc-900">
            {matchScore.best_score} pairs in {matchScore.best_time_seconds}s
          </p>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Study modes</h2>
        {modeCards.map((mode) => (
          <Link
            key={mode.key}
            href={`/dashboard/practice/flashcards/${deck.lessonId}/${mode.href}`}
            className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50/40"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-2xl">
              {mode.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-zinc-900">{mode.title}</p>
              <p className="mt-0.5 text-sm text-zinc-500">{mode.description}</p>
            </div>
            <span className="text-sm font-semibold text-violet-600">Start →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
