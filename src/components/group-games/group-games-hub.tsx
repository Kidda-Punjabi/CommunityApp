"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  createGameRoom,
  joinGameRoomByCode,
  type GroupGameActionResult,
} from "@/app/dashboard/group-games/actions";
import {
  GroupGameTopicPicker,
} from "@/components/group-games/group-game-content-filters";
import { BackLink } from "@/components/navigation/back-link";
import {
  DEFAULT_QUESTION_COUNT,
  GROUP_GAME_LABELS,
  GROUP_GAME_TYPES,
} from "@/lib/game-rooms/constants";
import type { GroupGameType } from "@/lib/game-rooms/types";
import {
  GROUP_GAMES_WITH_TOPIC_FILTER,
} from "@/lib/group-games/content-filters";
import type { TopicOption } from "@/lib/group-games/load-topic-options";
import { ui } from "@/lib/ui/styles";

const initial: GroupGameActionResult = {};

type GroupGamesHubProps = {
  initialJoinCode?: string;
  /** When set from Games tab, game type is locked (no second picker). */
  lockedGameType?: GroupGameType | null;
  flashcardTopics?: TopicOption[];
  grammarTopics?: TopicOption[];
};

function isGroupGameType(value: string | undefined | null): value is GroupGameType {
  return Boolean(value && GROUP_GAME_TYPES.includes(value as GroupGameType));
}

export function GroupGamesHub({
  initialJoinCode = "",
  lockedGameType = null,
  flashcardTopics = [],
  grammarTopics = [],
}: GroupGamesHubProps) {
  const gameLocked = isGroupGameType(lockedGameType);
  const [selectedGameType, setSelectedGameType] = useState<GroupGameType>(
    gameLocked ? lockedGameType : "buzz_in"
  );
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  const activeGameType = gameLocked ? lockedGameType : selectedGameType;

  useEffect(() => {
    setSelectedTopics([]);
  }, [activeGameType]);

  const topicOptions = useMemo(() => {
    if (activeGameType === "sentence_builder_group") return grammarTopics;
    if (GROUP_GAMES_WITH_TOPIC_FILTER.has(activeGameType)) return flashcardTopics;
    return [];
  }, [activeGameType, flashcardTopics, grammarTopics]);

  const showTopics = GROUP_GAMES_WITH_TOPIC_FILTER.has(activeGameType);
  const showQuestionCount =
    activeGameType === "buzz_in" || activeGameType === "sentence_builder_group";

  const [createState, createAction, createPending] = useActionState(createGameRoom, initial);
  const [joinState, joinAction, joinPending] = useActionState(joinGameRoomByCode, initial);

  return (
    <div className="space-y-8">
      <BackLink fallbackHref="/dashboard/games">← Back</BackLink>
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Group games</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Host a live classroom game or join with a code. Everyone waits in the lobby until the host
          starts.
        </p>
      </div>

      <section className={`${ui.card} space-y-5`}>
        <div>
          <h2 className="font-heading text-lg font-semibold text-zinc-900">Host a game</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {gameLocked
              ? "Confirm settings, create a room, and share the 6-character code with your class."
              : "Pick a game type, set filters, create a room, and share the code with your class."}
          </p>
        </div>

        <form action={createAction} className="space-y-5">
          {gameLocked ? (
            <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                Selected game
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">
                {GROUP_GAME_LABELS[lockedGameType]}
              </p>
              <input type="hidden" name="game_type" value={lockedGameType} />
            </div>
          ) : (
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Pick a game
              </legend>
              {GROUP_GAME_TYPES.map((gameType) => (
                <label
                  key={gameType}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border border-zinc-200/60 px-4 py-3"
                >
                  <input
                    type="radio"
                    name="game_type"
                    value={gameType}
                    checked={selectedGameType === gameType}
                    onChange={() => setSelectedGameType(gameType)}
                    className="h-4 w-4 accent-violet-600"
                  />
                  <span className="font-medium text-zinc-900">{GROUP_GAME_LABELS[gameType]}</span>
                </label>
              ))}
            </fieldset>
          )}

          {showQuestionCount ? (
            <div>
              <label
                htmlFor="question_count"
                className="mb-2 block text-sm font-semibold text-zinc-700"
              >
                Number of questions
              </label>
              <input
                id="question_count"
                name="question_count"
                type="number"
                min={1}
                max={50}
                defaultValue={DEFAULT_QUESTION_COUNT}
                className={ui.input}
              />
            </div>
          ) : (
            <input type="hidden" name="question_count" value={DEFAULT_QUESTION_COUNT} />
          )}

          {showTopics ? (
            <>
              <GroupGameTopicPicker
                options={topicOptions}
                selectedIds={selectedTopics}
                onChange={setSelectedTopics}
              />
              <input type="hidden" name="topic_tags" value={JSON.stringify(selectedTopics)} />
            </>
          ) : null}

          {activeGameType === "chado_pauri_group" ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              Chaṛo Pauṛī uses the full flashcard pool. Difficulty steps up with each rung, so
              topic/difficulty filters are not applied here yet.
            </p>
          ) : null}

          {activeGameType === "jeopardy" ? (
            <p className="text-sm text-zinc-500">
              Jeopardy keeps its Alphabet / Vocab / Sentences board and point values. Topics narrow
              which flashcards fill the tiles.
            </p>
          ) : null}

          {createState.error ? <p className="text-sm text-rose-600">{createState.error}</p> : null}

          <button type="submit" disabled={createPending} className={ui.btnPrimaryBlock}>
            {createPending ? "Creating…" : "Create room & get code"}
          </button>
        </form>
      </section>

      <div className="relative flex items-center gap-4">
        <div className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">or</span>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>

      <section className={`${ui.card} space-y-5`}>
        <div>
          <h2 className="font-heading text-lg font-semibold text-zinc-900">Join a game</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Enter the code your host shared to join their lobby.
          </p>
        </div>

        <form action={joinAction} className="space-y-4">
          <div>
            <label htmlFor="join_code" className="mb-2 block text-sm font-semibold text-zinc-700">
              Room code
            </label>
            <input
              id="join_code"
              name="join_code"
              type="text"
              defaultValue={initialJoinCode}
              placeholder="ABC123"
              autoComplete="off"
              maxLength={6}
              className={`${ui.input} text-center font-mono text-lg uppercase tracking-[0.25em]`}
            />
          </div>

          {joinState.error ? <p className="text-sm text-rose-600">{joinState.error}</p> : null}

          <button type="submit" disabled={joinPending} className={ui.btnPrimaryBlock}>
            {joinPending ? "Joining…" : "Join room"}
          </button>
        </form>
      </section>
    </div>
  );
}
