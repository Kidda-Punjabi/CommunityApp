import Link from "next/link";
import { DeckSelectList } from "@/components/games/deck-select-list";
import { loadAccessibleGameDecks } from "@/lib/games/load-game-decks";
import { createClient } from "@/lib/supabase/server";

export default async function StreakSurvivalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const decks = await loadAccessibleGameDecks(supabase, user!);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <Link
        href="/dashboard/games"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to games
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-zinc-900">Streak Survival</h1>
      <p className="mt-1 text-sm text-zinc-500">Pick a source for your survival run.</p>

      <div className="mt-6 space-y-6">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">Flashcard decks</h2>
          <Link
            href="/dashboard/games/streak-survival/foundational"
            className="block rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm transition-colors hover:border-violet-300"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
              Full course
            </p>
            <h3 className="mt-1 font-semibold text-zinc-900">Foundational Course — all decks</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Questions from anywhere across the Foundational Course
            </p>
          </Link>
          <p className="text-sm font-medium text-zinc-600">Or pick a single lesson deck:</p>
          <DeckSelectList
            gameSlug="streak-survival/deck"
            gameTitle="Streak Survival"
            decks={decks}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">Grammar sources</h2>
          <div className="grid gap-3">
            <Link
              href="/dashboard/games/streak-survival/gender"
              className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50/30"
            >
              <h3 className="font-semibold text-zinc-900">Gendered nouns</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Identify masculine or feminine nouns
              </p>
            </Link>
            <Link
              href="/dashboard/games/streak-survival/verbs"
              className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50/30"
            >
              <h3 className="font-semibold text-zinc-900">Verb conjugations</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Pick the correct verb form under pressure
              </p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
