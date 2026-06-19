import Link from "next/link";
import { DeckProgressBar } from "@/components/deck-progress-bar";
import type { FlashcardSetSummary } from "@/lib/flashcards/load-deck";
import { ui } from "@/lib/ui/styles";

type FlashcardLessonSetsHubProps = {
  lessonId: string;
  lessonTitle: string;
  courseName: string;
  lessonNumber: number;
  sets: FlashcardSetSummary[];
  backHref?: string;
  backLabel?: string;
};

export function FlashcardLessonSetsHub({
  lessonId,
  lessonTitle,
  courseName,
  lessonNumber,
  sets,
  backHref = "/dashboard/practice",
  backLabel = "Back to Practice",
}: FlashcardLessonSetsHubProps) {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href={backHref}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← {backLabel}
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
          {courseName} · Lesson {lessonNumber}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">{lessonTitle}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {sets.length} flashcard set{sets.length === 1 ? "" : "s"} linked to this lesson
        </p>
      </div>

      <div className={ui.stack}>
        {sets.map((set) => (
          <Link
            key={set.deckId}
            href={`/dashboard/practice/flashcards/${lessonId}/${set.deckId}`}
            className={`group block ${ui.cardBordered}`}
          >
            <div className="flex items-center gap-4">
              <span className={ui.listRowIcon} aria-hidden="true">
                🃏
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-zinc-900">{set.deckName}</h2>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {set.cards.length} card{set.cards.length === 1 ? "" : "s"}
                </p>
              </div>
              <span className={ui.btnIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4">
                  <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11.04-7.36a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <DeckProgressBar
                confident={set.stats.confident}
                notConfident={set.stats.notConfident}
                total={set.stats.total}
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
