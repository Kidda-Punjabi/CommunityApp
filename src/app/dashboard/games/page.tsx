import { GameCard } from "@/components/games/game-card";
import { ResourcesSection } from "@/components/resources/resources-section";
import { GAME_CATALOG } from "@/lib/games/catalog";
import { fetchPersonalBestsByGame } from "@/lib/games/game-scores";
import { ui } from "@/lib/ui/styles";
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
    <div className={ui.page}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Games</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Play vocabulary and grammar games to reinforce what you&apos;ve learned.
        </p>
      </div>

      <div className="space-y-10">
        <section>
          <h2 className={ui.sectionTitle}>Vocabulary Games</h2>
          <div className={ui.stack}>
            {vocabularyGames.map((game) => (
              <GameCard
                key={game.type}
                game={game}
                personalBest={personalBests.get(game.type) ?? null}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className={ui.sectionTitle}>Grammar Games</h2>
          <div className={ui.stack}>
            {grammarGames.map((game) => (
              <GameCard
                key={game.type}
                game={game}
                personalBest={personalBests.get(game.type) ?? null}
              />
            ))}
          </div>
        </section>

        <ResourcesSection />
      </div>
    </div>
  );
}
