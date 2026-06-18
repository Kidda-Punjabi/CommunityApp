import Link from "next/link";
import { DeckProgressBar } from "@/components/deck-progress-bar";
import type { FlashcardSetSummary } from "@/lib/flashcards/load-deck";

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

      <div className="space-y-3">
        {sets.map((set) => (
          <Link
            key={set.deckId}
            href={`/dashboard/practice/flashcards/${lessonId}/${set.deckId}`}
            className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold text-zinc-900">{set.deckName}</h2>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {set.cards.length} card{set.cards.length === 1 ? "" : "s"}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-violet-600">
                Practice →
              </span>
            </div>
            <div className="mt-3">
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
