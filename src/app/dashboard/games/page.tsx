import { GamesHub } from "@/components/games/games-hub";
import { getGamesTabData } from "@/lib/cache/tab-page-cache";
import { GAME_CATALOG } from "@/lib/games/catalog";
import { FREE_GAME_UNLOCK_COUNT } from "@/lib/games/premium-gating";
import {
  isEnglishGamesScope,
  resolveGamesContentScope,
} from "@/lib/games/content-scope";
import { hasTierAccess } from "@/lib/learning/learn-access";
import { hasPremiumAccess } from "@/lib/membership/premium-access";
import {
  getCachedAuthSession,
  getCachedCourseAccess,
} from "@/lib/supabase/cached-session";
import { redirect } from "next/navigation";

export default async function GamesPage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const [personalBests, isPremium, scope, courseAccess] = await Promise.all([
    getGamesTabData(session.user.id),
    hasPremiumAccess(session.supabase, session.user.id),
    resolveGamesContentScope(session.supabase, session.user.id),
    getCachedCourseAccess(session.supabase, session.user),
  ]);

  const englishMode = isEnglishGamesScope(scope);
  const hasFoundationalAccess = hasTierAccess(courseAccess, "foundational");
  const vocabularyGames = GAME_CATALOG.filter((g) => {
    if (g.section !== "vocabulary") return false;
    if (englishMode && (g.type === "vowel_match" || g.type === "sound_match")) return false;
    return true;
  });
  const grammarGames = englishMode
    ? []
    : GAME_CATALOG.filter((g) => g.section === "grammar");

  return (
    <div className="flex flex-col px-5 py-7">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Games</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {englishMode
            ? "Play vocabulary games with your Learn English flashcards."
            : isPremium
              ? "Play vocabulary and grammar games to reinforce what you've learned."
              : hasFoundationalAccess
                ? "Foundational Course includes Sound Match and Vowel Match, plus the first four games. Premium unlocks the full catalogue."
                : `Free includes the first ${FREE_GAME_UNLOCK_COUNT} games. Premium unlocks the full catalogue.`}
        </p>
      </div>

      <GamesHub
        vocabularyGames={vocabularyGames}
        grammarGames={grammarGames}
        personalBests={personalBests}
        isPremium={isPremium}
        hasFoundationalAccess={hasFoundationalAccess}
        hideGrammar={englishMode}
      />
    </div>
  );
}
