"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  createGameRoom,
  joinGameRoomByCode,
  type GroupGameActionResult,
} from "@/app/dashboard/group-games/actions";
import { GroupGameTopicPicker } from "@/components/group-games/group-game-content-filters";
import { BackLink } from "@/components/navigation/back-link";
import {
  DEFAULT_QUESTION_COUNT,
  GROUP_GAME_LABELS,
  GROUP_GAME_TYPES,
} from "@/lib/game-rooms/constants";
import {
  DEFAULT_GROUP_RACE_WIN_SCORE,
  RACE_WIN_SCORE_OPTIONS,
} from "@/lib/game-rooms/race";
import type { GroupGameType } from "@/lib/game-rooms/types";
import { GROUP_GAMES_WITH_TOPIC_FILTER } from "@/lib/group-games/content-filters";
import type { TopicOption } from "@/lib/group-games/load-topic-options";
import {
  SOUND_MATCH_FULL_ID,
  SOUND_MATCH_GROUPS,
  isFullAlphabet,
  type SoundMatchSelectionId,
} from "@/lib/games/sound-match";
import { ui } from "@/lib/ui/styles";

const initial: GroupGameActionResult = {};

type HubStep = "entry" | "host" | "join";

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
  const [step, setStep] = useState<HubStep>(initialJoinCode ? "join" : "entry");
  const [selectedGameType, setSelectedGameType] = useState<GroupGameType>(
    gameLocked ? lockedGameType : "buzz_in"
  );
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [winScore, setWinScore] = useState<(typeof RACE_WIN_SCORE_OPTIONS)[number]>(
    DEFAULT_GROUP_RACE_WIN_SCORE
  );
  const [soundMatchGroups, setSoundMatchGroups] = useState<SoundMatchSelectionId[]>([
    SOUND_MATCH_FULL_ID,
  ]);

  const activeGameType = gameLocked ? lockedGameType : selectedGameType;
  const gameTitle = GROUP_GAME_LABELS[activeGameType];

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
  const showRaceWinScore =
    activeGameType === "sound_match_group" || activeGameType === "vowel_match_group";
  const showSoundMatchGroups = activeGameType === "sound_match_group";

  const [createState, createAction, createPending] = useActionState(createGameRoom, initial);
  const [joinState, joinAction, joinPending] = useActionState(joinGameRoomByCode, initial);

  if (step === "entry") {
    return (
      <div className="space-y-8">
        <BackLink fallbackHref="/dashboard/games">← Back</BackLink>
        <h1 className="text-2xl font-bold text-zinc-900">{gameTitle}</h1>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setStep("host")}
            className={`${ui.card} flex min-h-[9rem] items-center justify-center border-2 border-violet-200 bg-violet-50 text-center text-lg font-bold text-zinc-900 transition-colors hover:border-violet-400 hover:bg-violet-100`}
          >
            Host a game
          </button>
          <button
            type="button"
            onClick={() => setStep("join")}
            className={`${ui.card} flex min-h-[9rem] items-center justify-center border-2 border-zinc-200 text-center text-lg font-bold text-zinc-900 transition-colors hover:border-violet-300 hover:bg-violet-50`}
          >
            Join a game
          </button>
        </div>
      </div>
    );
  }

  if (step === "join") {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setStep("entry")}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{gameTitle}</h1>
          <p className="mt-1 text-sm text-zinc-500">Enter the code your host shared.</p>
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => setStep("entry")}
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back
      </button>
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">{gameTitle}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Confirm settings, create a room, and share the code.
        </p>
      </div>

      <form action={createAction} className="space-y-5">
        {gameLocked ? (
          <input type="hidden" name="game_type" value={lockedGameType} />
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

        {showRaceWinScore ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              First to
            </p>
            <div className="flex flex-wrap gap-2">
              {RACE_WIN_SCORE_OPTIONS.map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setWinScore(score)}
                  className={winScore === score ? ui.pillActive : ui.pillInactive}
                >
                  {score} points
                </button>
              ))}
            </div>
            <input type="hidden" name="win_score" value={winScore} />
            <p className="text-sm text-zinc-500">
              Players race independently. First to {winScore} correct answers wins.
            </p>
          </div>
        ) : null}

        {showSoundMatchGroups ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Letter groups
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSoundMatchGroups([SOUND_MATCH_FULL_ID])}
                className={isFullAlphabet(soundMatchGroups) ? ui.pillActive : ui.pillInactive}
              >
                Full alphabet
              </button>
              {SOUND_MATCH_GROUPS.map((group) => {
                const active =
                  !isFullAlphabet(soundMatchGroups) && soundMatchGroups.includes(group.id);
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() =>
                      setSoundMatchGroups((current) => {
                        const withoutFull = current.filter((value) => value !== SOUND_MATCH_FULL_ID);
                        if (withoutFull.includes(group.id)) {
                          const next = withoutFull.filter((value) => value !== group.id);
                          return next.length > 0 ? next : [SOUND_MATCH_FULL_ID];
                        }
                        return [...withoutFull, group.id];
                      })
                    }
                    className={active ? ui.pillActive : ui.pillInactive}
                  >
                    {group.label}
                  </button>
                );
              })}
            </div>
            <input
              type="hidden"
              name="sound_match_groups"
              value={JSON.stringify(soundMatchGroups)}
            />
          </div>
        ) : null}

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
          <p className="text-sm text-zinc-500">
            Chaṛo Pauṛī steps up difficulty with each rung. Topics narrow which flashcards fill the
            ladder.
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
    </div>
  );
}
