import Link from "next/link";
import { DeckSelectList } from "@/components/games/deck-select-list";
import { loadAccessibleGameDecks } from "@/lib/games/load-game-decks";
import { createClient } from "@/lib/supabase/server";

export default async function MatchDeckSelectPage() {
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
      <h1 className="mt-4 text-2xl font-bold text-zinc-900">Match</h1>
      <p className="mt-1 text-sm text-zinc-500">Choose a flashcard deck to play.</p>
      <div className="mt-6">
        <DeckSelectList gameSlug="match" gameTitle="Match" decks={decks} />
      </div>
    </div>
  );
}
