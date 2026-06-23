import { GameCard } from "@/components/games/game-card";
import { ResourcesSection } from "@/components/resources/resources-section";
import { GAME_CATALOG } from "@/lib/games/catalog";
import { fetchPersonalBestsByGame } from "@/lib/games/game-scores";
import { ui } from "@/lib/ui/styles";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

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
          <h2 className={ui.sectionTitle}>Live PvP</h2>
          <Link href="/dashboard/battle/create" className={ui.cardInteractive}>
            <div className="flex items-center gap-4">
              <span className={ui.listRowIcon} aria-hidden="true">
                ⚡
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">
                  Real-time
                </p>
                <p className="mt-0.5 font-heading font-semibold text-zinc-900">Battle a Friend</p>
                <p className="mt-0.5 text-sm text-zinc-500">
                  Live 1v1 — race to answer the same question and deal damage
                </p>
              </div>
            </div>
          </Link>
        </section>

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
