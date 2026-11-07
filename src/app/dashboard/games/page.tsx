import { Suspense } from "react";
import { GamesLeaderboardCard, type GamesLeaderboardPreview } from "@/components/games/games-category-cards";
import { GamesCategoryList, GamesHub, isGamesCategoryId, type GamesCategoryId } from "@/components/games/games-hub";
import { PageSpinner } from "@/components/ui/page-spinner";
import { loadLeaderboard } from "@/lib/leaderboard/load-leaderboard";
import { getCurrentWeekStart } from "@/lib/leaderboard/week";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { HubLinkTile } from "@/components/games/hub-link-tile";
import { getGamesTabData } from "@/lib/cache/tab-page-cache";
import { usesKidsShell } from "@/lib/kids/constants";
import { loadKidSession } from "@/lib/kids/session";
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
import { getIsNativeApp } from "@/lib/native/platform-server";
import { redirect } from "next/navigation";

function GamesHome({
  englishMode,
  showLeaderboard,
  userId,
}: {
  englishMode: boolean;
  showLeaderboard: boolean;
  userId: string;
}) {
  return (
    <div className="flex flex-1 flex-col px-4 pb-4 pt-5">
      <h1 className="mb-3 font-heading text-[28px] font-extrabold leading-8 tracking-tight text-zinc-900">Games</h1>
      {showLeaderboard ? (
        <Suspense fallback={<GamesLeaderboardCard preview={null} />}>
          <GamesLeaderboardSlot userId={userId} />
        </Suspense>
      ) : null}
      <GamesHub hideGrammar={englishMode} />
    </div>
  );
}

async function GamesLeaderboardSlot({ userId }: { userId: string }) {
  const board = await loadLeaderboard(createServiceRoleClient(), getCurrentWeekStart(), userId).catch((error) => {
    console.error("[games] leaderboard preview failed", error);
    return null;
  });
  const preview: GamesLeaderboardPreview | null = board && {
    top: board.entries.slice(0, 3).map((e) => ({ userId: e.userId, name: e.displayName, points: e.points, rank: e.rank ?? 0 })),
    youRank: board.viewerRow.rank,
    youPoints: board.viewerRow.points,
  };
  return <GamesLeaderboardCard preview={preview} />;
}

async function GamesCategoryScreen({ category }: { category: GamesCategoryId }) {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const scope = await resolveGamesContentScope(session.supabase, session.user.id);
  const englishMode = isEnglishGamesScope(scope);
  if (category === "grammar" && englishMode) {
    const kidSession = await loadKidSession(session.user.id);
    return (
      <GamesHome
        englishMode
        showLeaderboard={!kidSession.activeKidProfile}
        userId={session.user.id}
      />
    );
  }

  const [personalBests, isPremium, courseAccess, kidSession, nativeApp] = await Promise.all([
    getGamesTabData(session.user.id),
    hasPremiumAccess(session.supabase, session.user.id),
    getCachedCourseAccess(session.supabase, session.user),
    loadKidSession(session.user.id),
    getIsNativeApp(),
  ]);
  const olderKid =
    kidSession.activeKidProfile && !usesKidsShell(kidSession.activeKidProfile.age_tier);
  const hasFoundationalAccess = hasTierAccess(courseAccess, "foundational");
  const vocabularyGames = GAME_CATALOG.filter((g) => {
    if (g.section !== "vocabulary") return false;
    if (englishMode && (g.type === "vowel_match" || g.type === "sound_match")) return false;
    return true;
  });
  const grammarGames = englishMode ? [] : GAME_CATALOG.filter((g) => g.section === "grammar");
  const note = englishMode
    ? "Play vocabulary games with your Learn English flashcards."
    : isPremium || nativeApp
      ? null
      : hasFoundationalAccess
        ? "Foundational Course includes Sound Match and Vowel Match, plus the first four games. Premium unlocks the full catalogue."
        : `Free includes the first ${FREE_GAME_UNLOCK_COUNT} games. Premium unlocks the full catalogue.`;

  return (
    <div className="flex flex-col px-4 pb-6 pt-5">
      <GamesCategoryList
        category={category}
        vocabularyGames={vocabularyGames}
        grammarGames={grammarGames}
        personalBests={personalBests}
        isPremium={isPremium}
        hasFoundationalAccess={hasFoundationalAccess}
        note={category === "vocab" || category === "grammar" ? note : null}
        extraVocabularyTiles={
          olderKid ? (
            <HubLinkTile title="Bedtime Stories" emoji="🌙" href="/dashboard/games/bedtime-stories" />
          ) : null
        }
      />
    </div>
  );
}

export default async function GamesPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  if (isGamesCategoryId(category)) {
    return (
      <Suspense fallback={<PageSpinner />}>
        <GamesCategoryScreen category={category} />
      </Suspense>
    );
  }

  const [scope, kidSession] = await Promise.all([
    resolveGamesContentScope(session.supabase, session.user.id),
    loadKidSession(session.user.id),
  ]);

  return (
    <GamesHome
      englishMode={isEnglishGamesScope(scope)}
      showLeaderboard={!kidSession.activeKidProfile}
      userId={session.user.id}
    />
  );
}
