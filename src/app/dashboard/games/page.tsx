import { GamesHub } from "@/components/games/games-hub";
import { getGamesTabData } from "@/lib/cache/tab-page-cache";
import { GAME_CATALOG } from "@/lib/games/catalog";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { redirect } from "next/navigation";

export default async function GamesPage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const personalBests = await getGamesTabData(session.user.id);

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
