import { GamesHub } from "@/components/games/games-hub";
import { GAME_CATALOG } from "@/lib/games/catalog";
import { fetchPersonalBestsByGame } from "@/lib/games/game-scores";
import { createClient } from "@/lib/supabase/server";

export default async function GamesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const personalBestsMap = await fetchPersonalBestsByGame(supabase, user!.id);
  const personalBests: Record<string, number> = {};
  for (const [type, score] of personalBestsMap.entries()) {
    personalBests[type] = score;
  }

  const vocabularyGames = GAME_CATALOG.filter((g) => g.section === "vocabulary");
  const grammarGames = GAME_CATALOG.filter((g) => g.section === "grammar");

  return (
    <div className="flex flex-col px-5 py-7">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Games</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Play vocabulary and grammar games to reinforce what you&apos;ve learned.
        </p>
      </div>

      <GamesHub
        vocabularyGames={vocabularyGames}
        grammarGames={grammarGames}
        personalBests={personalBests}
      />
    </div>
  );
}
