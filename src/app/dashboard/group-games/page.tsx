import { GroupGamesHub } from "@/components/group-games/group-games-hub";
import { GROUP_GAME_TYPES } from "@/lib/game-rooms/constants";
import type { GroupGameType } from "@/lib/game-rooms/types";
import {
  loadFlashcardTopicOptions,
  loadGrammarSentenceTopicOptions,
} from "@/lib/group-games/load-topic-options";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";

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

  const [flashcardTopics, grammarTopics] = await Promise.all([
    loadFlashcardTopicOptions(supabase).catch(() => []),
    loadGrammarSentenceTopicOptions(supabase).catch(() => []),
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
      />
    </div>
  );
}
