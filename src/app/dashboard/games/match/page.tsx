import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import { GameDeckCoursePicker } from "@/components/games/game-deck-course-picker";
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
      <BackLink fallbackHref="/dashboard/games">← Back</BackLink>
      <h1 className="mt-4 text-2xl font-bold text-zinc-900">Match</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Choose a course level, then pick a flashcard deck.
      </p>
      <div className="mt-6">
        <GameDeckCoursePicker gameSlug="match" gameTitle="Match" decks={decks} />
      </div>
    </div>
  );
}
