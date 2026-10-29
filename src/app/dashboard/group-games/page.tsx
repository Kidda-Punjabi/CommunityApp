import { GroupGamesHub } from "@/components/group-games/group-games-hub";
import { GROUP_GAME_TYPES } from "@/lib/game-rooms/constants";
import type { GroupGameType } from "@/lib/game-rooms/types";
import {
  loadFlashcardTopicOptions,
  loadGrammarSentenceTopicOptions,
} from "@/lib/group-games/load-topic-options";
import { createClient } from "@/lib/supabase/server";
import { loadBuzzInTopicCatalogue } from "@/lib/buzz-in/load-topic-catalogue";
import { BUZZ_IN_MIN_QUESTIONS, type BuzzInTopicCatalogue } from "@/lib/buzz-in/topic-catalogue";

function catalogueHasQuestions(catalogue: BuzzInTopicCatalogue): boolean {
  return (
    catalogue.themes.some((theme) => theme.count >= BUZZ_IN_MIN_QUESTIONS) ||
    catalogue.courses.some((course) => course.weeks.some((week) => week.count >= BUZZ_IN_MIN_QUESTIONS))
  );
}
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

type GroupGamesPageProps = {
  searchParams: Promise<{ cancelled?: string; game_type?: string }>;
};

function resolveLockedGameType(value?: string): GroupGameType | null {
  if (value && GROUP_GAME_TYPES.includes(value as GroupGameType)) {
    return value as GroupGameType;
  }
  return null;
}

export default async function GroupGamesPage({ searchParams }: GroupGamesPageProps) {
  const { cancelled, game_type: gameType } = await searchParams;
  const lockedGameType = resolveLockedGameType(gameType);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const needsBuzzInCatalogue = lockedGameType === null || lockedGameType === "buzz_in";
  const [flashcardTopics, grammarTopics, buzzInCatalogue] = await Promise.all([
    loadFlashcardTopicOptions(supabase).catch(() => []),
    loadGrammarSentenceTopicOptions(supabase).catch(() => []),
    needsBuzzInCatalogue
      ? loadBuzzInTopicCatalogue(supabase)
          // No askable cards at all (e.g. a Learn English account): keep the plain topic picker.
          .then((catalogue) => (catalogueHasQuestions(catalogue) ? catalogue : null))
          .catch((error) => {
          console.error("[group-games] buzz-in topic catalogue failed", error);
          return null;
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className={ui.page}>
      {cancelled === "1" ? (
        <p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The host left — this room was cancelled.
        </p>
      ) : null}
      <GroupGamesHub
        lockedGameType={lockedGameType}
        flashcardTopics={flashcardTopics}
        grammarTopics={grammarTopics}
        buzzInCatalogue={buzzInCatalogue}
      />
    </div>
  );
}
