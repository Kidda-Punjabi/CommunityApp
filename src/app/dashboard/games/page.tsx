import { GameCard } from "@/components/games/game-card";
import { GAME_CATALOG } from "@/lib/games/catalog";
import { fetchPersonalBestsByGame } from "@/lib/games/game-scores";
import { createClient } from "@/lib/supabase/server";

export default async function GamesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const personalBests = await fetchPersonalBestsByGame(supabase, user!.id);

  const vocabularyGames = GAME_CATALOG.filter((g) => g.section === "vocabulary");
  const grammarGames = GAME_CATALOG.filter((g) => g.section === "grammar");

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Games</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Play vocabulary and grammar games to reinforce what you&apos;ve learned.
        </p>
      </div>

      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">Vocabulary Games</h2>
          <div className="space-y-3">
            {vocabularyGames.map((game) => (
              <GameCard
                key={game.type}
                game={game}
                personalBest={personalBests.get(game.type) ?? null}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">Grammar Games</h2>
          <div className="space-y-3">
            {grammarGames.map((game) => (
              <GameCard
                key={game.type}
                game={game}
                personalBest={personalBests.get(game.type) ?? null}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
