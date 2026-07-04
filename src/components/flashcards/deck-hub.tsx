import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import { DeckProgressBar } from "@/components/deck-progress-bar";
import {
  computeDeckConfidenceStats,
  type FlashcardProgressRow,
} from "@/lib/progress/flashcard-progress";
import type { MatchScoreRow } from "@/lib/progress/match-scores";
import type { FlashcardDeckContext } from "@/lib/flashcards/types";
import { deckPracticeHref, gameDeckHref } from "@/lib/flashcards/utils";
import { ui } from "@/lib/ui/styles";

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
  const deckId = deck.deckId;
  const setsHref = `/dashboard/practice/flashcards/${deck.lessonId}`;

  return (
    <div className="space-y-6">
      <div>
        <BackLink fallbackHref={setsHref} className="text-sm font-medium text-violet-600 hover:text-violet-500">← Back to flashcard sets</BackLink>
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
        <div className="rounded-3xl border border-violet-200/80 bg-violet-50 px-5 py-4 shadow-[0_4px_24px_-6px_rgba(124,58,237,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Match best
          </p>
          <p className="mt-1 text-lg font-bold text-zinc-900">
            {matchScore.best_score} pairs in {matchScore.best_time_seconds}s
          </p>
        </div>
      )}

      <div className={ui.stack}>
        <h2 className={ui.sectionTitle}>Study modes</h2>
        {modeCards.map((mode) => {
          const href =
            mode.key === "match" && deckId
              ? gameDeckHref("match", deck.lessonId, deckId)
              : deckId
                ? deckPracticeHref(deck.lessonId, deckId, mode.href)
                : setsHref;

          return (
            <Link key={mode.key} href={href} className={`group ${ui.listRow}`}>
              <span className={ui.listRowIcon} aria-hidden="true">
                {mode.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-zinc-900">{mode.title}</p>
                <p className="mt-0.5 text-sm text-zinc-500">{mode.description}</p>
              </div>
              <span className={ui.btnIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4">
                  <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11.04-7.36a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
                </svg>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
