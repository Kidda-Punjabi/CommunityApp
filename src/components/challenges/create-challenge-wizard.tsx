"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { createFriendChallenge, type ActionResult } from "@/app/dashboard/challenges/actions";
import { UserAvatar } from "@/components/profile/user-avatar";
import { GAME_CATALOG } from "@/lib/games/catalog";
import type { ChallengeConfig, StreakSurvivalVariant } from "@/lib/challenges/types";
import type { FriendListItem } from "@/lib/friends/load-friends";
import type { GameDeckSummary } from "@/lib/games/load-game-decks";
import {
  QUESTION_COUNT_OPTIONS,
  type GameSessionSettingsChoice,
  type QuestionCount,
} from "@/lib/games/session-settings";
import type { GameType } from "@/lib/games/types";
import { ui } from "@/lib/ui/styles";

const initial: ActionResult = {};

type CreateChallengeWizardProps = {
  friends: FriendListItem[];
  decks: GameDeckSummary[];
};

type Step = "friend" | "game" | "config";

export function CreateChallengeWizard({ friends, decks }: CreateChallengeWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("friend");
  const [friendId, setFriendId] = useState<string | null>(null);
  const [gameType, setGameType] = useState<GameType | null>(null);
  const [questionCount, setQuestionCount] = useState<QuestionCount>(10);
  const [streakVariant, setStreakVariant] = useState<StreakSurvivalVariant>("foundational");
  const [deckSelection, setDeckSelection] = useState<{
    lessonId: string;
    deckId: string;
    deckName: string;
  } | null>(null);

  const [state, formAction, pending] = useActionState(createFriendChallenge, initial);

  const selectedFriend = friends.find((friend) => friend.userId === friendId) ?? null;
  const selectedGame = GAME_CATALOG.find((game) => game.type === gameType) ?? null;

  const configPayload = useMemo(() => {
    const config: Partial<ChallengeConfig> = {
      session: { questionCount, filterIds: ["mixed"] },
    };

    if (gameType === "streak_survival") {
      config.streakVariant = streakVariant;
      if (streakVariant === "deck" && deckSelection) {
        config.deck = deckSelection;
      }
    } else if (selectedGame?.needsDeck && deckSelection) {
      config.deck = deckSelection;
    }

    return JSON.stringify(config);
  }, [gameType, questionCount, streakVariant, deckSelection, selectedGame?.needsDeck]);

  useEffect(() => {
    if (state.playHref) {
      router.push(state.playHref);
    }
  }, [state.playHref, router]);

  const needsDeck =
    selectedGame?.needsDeck || (gameType === "streak_survival" && streakVariant === "deck");
  const needsGrammarConfig =
    gameType === "sentence_builder" ||
    gameType === "conjugation_challenge" ||
    gameType === "gender_sort";

  function handleDeckPick(lessonId: string, deckId: string, deckName: string) {
    setDeckSelection({ lessonId, deckId, deckName });
    setStep("config");
  }

  return (
    <div className={`${ui.page} ${ui.stackLoose}`}>
      <div>
        <Link href="/dashboard/friends" className="text-sm font-medium text-violet-600">
          ← Friends
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-zinc-900">Challenge a friend</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Play a game first — your friend gets notified with your score and can try to beat it.
        </p>
      </div>

      {friends.length === 0 ? (
        <div className={ui.emptyState}>
          <p className="text-sm text-zinc-500">Add friends first to send a challenge.</p>
          <Link href="/dashboard/friends" className="mt-3 text-sm font-semibold text-violet-600">
            Go to friends →
          </Link>
        </div>
      ) : (
        <>
          {step === "friend" && (
            <div className={ui.card}>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                Step 1 — Pick a friend
              </p>
              <ul className="mt-3 space-y-2">
                {friends.map((friend) => (
                  <li key={friend.userId}>
                    <button
                      type="button"
                      onClick={() => {
                        setFriendId(friend.userId);
                        setStep("game");
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-left hover:border-violet-200 hover:bg-violet-50/50"
                    >
                      <UserAvatar
                        profile={{
                          full_name: friend.displayName,
                          preferred_name: null,
                          avatar_url: friend.avatarUrl,
                        }}
                        level={friend.learnerLevel}
                        size="sm"
                      />
                      <span className="text-sm font-medium text-zinc-900">{friend.displayName}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === "game" && selectedFriend && (
            <div className={ui.card}>
              <button
                type="button"
                onClick={() => setStep("friend")}
                className="text-sm font-medium text-violet-600"
              >
                ← Change friend
              </button>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-violet-600">
                Step 2 — Pick a game
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                Challenging <span className="font-semibold">{selectedFriend.displayName}</span>
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {GAME_CATALOG.map((game) => (
                  <li key={game.type}>
                    <button
                      type="button"
                      onClick={() => {
                        setGameType(game.type);
                        if (game.needsDeck) {
                          setStep("config");
                        } else if (game.type === "streak_survival") {
                          setStep("config");
                        } else if (
                          game.type === "sentence_builder" ||
                          game.type === "conjugation_challenge" ||
                          game.type === "gender_sort"
                        ) {
                          setStep("config");
                        } else {
                          setStep("config");
                        }
                      }}
                      className="flex w-full items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left hover:border-violet-300 hover:bg-violet-50/30"
                    >
                      <span className="text-2xl">{game.emoji}</span>
                      <span>
                        <span className="block font-semibold text-zinc-900">{game.title}</span>
                        <span className="mt-0.5 block text-xs text-zinc-500">{game.description}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === "config" && selectedFriend && selectedGame && (
            <form action={formAction} className={ui.card}>
              <button
                type="button"
                onClick={() => setStep("game")}
                className="text-sm font-medium text-violet-600"
              >
                ← Change game
              </button>

              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-violet-600">
                Step 3 — Settings
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                {selectedGame.emoji} {selectedGame.title} vs {selectedFriend.displayName}
              </p>

              <input type="hidden" name="friend_id" value={friendId ?? ""} />
              <input type="hidden" name="game_type" value={gameType ?? ""} />
              <input type="hidden" name="config" value={configPayload} />

              {gameType === "streak_survival" && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-zinc-700">Streak source</p>
                  {(
                    [
                      ["foundational", "Foundational course (all decks)"],
                      ["gender", "Gendered nouns"],
                      ["verbs", "Verb conjugations"],
                      ["deck", "Single flashcard deck"],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="radio"
                        name="streak_variant_ui"
                        checked={streakVariant === value}
                        onChange={() => {
                          setStreakVariant(value);
                          if (value !== "deck") setDeckSelection(null);
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}

              {needsDeck && !deckSelection && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-zinc-700">Pick a deck</p>
                  {decks.length === 0 ? (
                    <p className="text-sm text-zinc-500">No decks available for this game.</p>
                  ) : (
                    decks.map((deck) => (
                      <button
                        key={`${deck.lessonId}-${deck.deckId}`}
                        type="button"
                        onClick={() =>
                          handleDeckPick(deck.lessonId, deck.deckId, deck.setName)
                        }
                        className="block w-full rounded-2xl border border-zinc-200 bg-white p-4 text-left hover:border-violet-300 hover:bg-violet-50/30"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                          {deck.courseName}
                        </p>
                        <p className="mt-1 font-semibold text-zinc-900">{deck.setName}</p>
                        <p className="text-sm text-zinc-500">{deck.lessonTitle}</p>
                      </button>
                    ))
                  )}
                </div>
              )}

              {needsDeck && deckSelection && (
                <p className="mt-4 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-800">
                  Deck: <span className="font-semibold">{deckSelection.deckName}</span>
                  <button
                    type="button"
                    className="ml-2 text-violet-600 underline"
                    onClick={() => setDeckSelection(null)}
                  >
                    Change
                  </button>
                </p>
              )}

              {needsGrammarConfig && (
                <div className="mt-4">
                  <label htmlFor="question-count" className="text-sm font-medium text-zinc-700">
                    Questions
                  </label>
                  <select
                    id="question-count"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value) as QuestionCount)}
                    className="mt-1 block w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  >
                    {QUESTION_COUNT_OPTIONS.map((count) => (
                      <option key={count} value={count}>
                        {count} questions
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {state.error && <p className="mt-4 text-sm text-red-600">{state.error}</p>}

              <button
                type="submit"
                disabled={pending || (needsDeck && !deckSelection)}
                className={`mt-5 ${ui.btnPrimaryBlock}`}
              >
                {pending ? "Starting…" : "Start challenge"}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
