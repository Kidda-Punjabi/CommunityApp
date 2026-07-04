"use client";

import { BackLink } from "@/components/navigation/back-link";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ConversationTranscript,
  type TranscriptEntry,
} from "@/components/conversation/conversation-transcript";
import { getConversationCharacterEmoji } from "@/components/conversation/conversation-bubble";
import { GameSessionReview } from "@/components/games/game-session-review";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import { saveGameScore } from "@/lib/games/game-scores";
import {
  CONVERSATION_DIFFICULTIES,
  CONVERSATION_DIFFICULTY_DESCRIPTIONS,
  CONVERSATION_DIFFICULTY_LABELS,
  CONVERSATION_PRACTICE_DISPLAY_NAME,
  type ConversationDifficulty,
} from "@/lib/conversation/config";
import {
  buildEasyOptions,
  buildEasyRomanisedBlankTemplate,
  buildHardTileBank,
  buildMediumOptions,
  easyRomanisedWordForDisplay,
  fillEasyBlank,
  hardAnswerMatches,
  type EasyWordOption,
  type MediumSentenceOption,
} from "@/lib/conversation/exchange-questions";
import type {
  ConversationCharacter,
  ConversationExchange,
  ConversationExchangeResult,
  ConversationPracticeContent,
  ConversationScenario,
} from "@/lib/conversation/types";
import type { SentenceTile } from "@/lib/conjugation/sentence-builder";
import {
  appendTranscriptEntry,
  npcReplyEntry,
  npcSetupEntry,
  studentAnswerEntry,
} from "@/lib/conversation/transcript";
import { createClient } from "@/lib/supabase/client";

const ADVANCE_MS = 1400;

type SetupPhase = "characters" | "scenarios" | "difficulty";
type PlayPhase = "playing" | "finished";
type ExchangeStep = "question" | "feedback" | "reply";

type ConversationPracticeModeProps = ConversationPracticeContent;

export function ConversationPracticeMode({
  characters,
  scenarios,
  exchangesByScenario,
  tableReady,
  loadError,
}: ConversationPracticeModeProps) {
  const [setupPhase, setSetupPhase] = useState<SetupPhase>("characters");
  const [playPhase, setPlayPhase] = useState<PlayPhase | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<ConversationDifficulty | null>(null);
  const [exchanges, setExchanges] = useState<ConversationExchange[]>([]);
  const [exchangeIndex, setExchangeIndex] = useState(0);
  const [exchangeStep, setExchangeStep] = useState<ExchangeStep>("question");
  const [results, setResults] = useState<ConversationExchangeResult[]>([]);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);

  const [easyOptions, setEasyOptions] = useState<EasyWordOption[]>([]);
  const [easySelected, setEasySelected] = useState<EasyWordOption | null>(null);
  const [mediumOptions, setMediumOptions] = useState<MediumSentenceOption[]>([]);
  const [hardBank, setHardBank] = useState<SentenceTile[]>([]);
  const [hardBuilt, setHardBuilt] = useState<SentenceTile[]>([]);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const advanceTimerRef = useRef<number | null>(null);
  const answeringRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);

  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === selectedCharacterId) ?? null,
    [characters, selectedCharacterId]
  );

  const characterScenarios = useMemo(() => {
    if (!selectedCharacterId) return [];
    return scenarios.filter((scenario) => scenario.character_id === selectedCharacterId);
  }, [scenarios, selectedCharacterId]);

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null,
    [scenarios, selectedScenarioId]
  );

  const currentExchange = exchanges[exchangeIndex] ?? null;
  const correctCount = results.filter((result) => result.correct).length;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        window.clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (playPhase !== "finished" || savedRef.current || !selectedCharacter || !selectedScenario) {
      return;
    }
    savedRef.current = true;

    const total = exchanges.length;
    const correct = results.filter((result) => result.correct).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    const persist = async () => {
      const userId = userIdRef.current;
      if (!userId || !difficulty) return;

      const supabase = createClient();
      const outcome = await saveGameScore(supabase, userId, "conversation_practice", correct, {
        accuracy,
        correct,
        total,
        character_id: selectedCharacter.id,
        scenario_id: selectedScenario.id,
        difficulty,
        exchanges: results,
      });
      setPointsEarned(outcome.pointsEarned);
    };

    void persist();
  }, [playPhase, results, exchanges.length, selectedCharacter, selectedScenario, difficulty]);

  function resetQuestionState(exchange: ConversationExchange) {
    answeringRef.current = false;
    setExchangeStep("question");
    setEasySelected(null);
    setHardBuilt([]);
    setEasyOptions(buildEasyOptions(exchange));
    setMediumOptions(buildMediumOptions(exchange));
    setHardBank(buildHardTileBank(exchange.hard_word_tiles, exchange.id));
  }

  function startScenario(selectedDifficulty: ConversationDifficulty) {
    if (!selectedScenarioId) return;
    const scenarioExchanges = exchangesByScenario[selectedScenarioId] ?? [];
    if (scenarioExchanges.length === 0) return;

    savedRef.current = false;
    setDifficulty(selectedDifficulty);
    setExchanges(scenarioExchanges);
    setExchangeIndex(0);
    setResults([]);
    setTranscript([npcSetupEntry(scenarioExchanges[0])]);
    setPlayPhase("playing");
    resetQuestionState(scenarioExchanges[0]);
  }

  function scheduleAdvance(callback: () => void) {
    if (advanceTimerRef.current) {
      window.clearTimeout(advanceTimerRef.current);
    }
    advanceTimerRef.current = window.setTimeout(callback, ADVANCE_MS);
  }

  function goToNextExchange() {
    const nextIndex = exchangeIndex + 1;
    if (nextIndex >= exchanges.length) {
      setPlayPhase("finished");
      return;
    }

    setExchangeIndex(nextIndex);
    resetQuestionState(exchanges[nextIndex]);
    setTranscript((prev) => appendTranscriptEntry(prev, npcSetupEntry(exchanges[nextIndex])));
  }

  function recordResult(exchange: ConversationExchange, correct: boolean) {
    if (answeringRef.current) return;
    answeringRef.current = true;

    setTranscript((prev) => appendTranscriptEntry(prev, studentAnswerEntry(exchange)));
    setResults((prev) => [
      ...prev,
      {
        exchange_id: exchange.id,
        sequence_order: exchange.sequence_order,
        correct,
      },
    ]);
    setLastCorrect(correct);
    setExchangeStep("feedback");
  }

  function afterFeedback(exchange: ConversationExchange) {
    const reply = npcReplyEntry(exchange);

    if (reply) {
      setExchangeStep("reply");
      setTranscript((prev) => appendTranscriptEntry(prev, reply));
      scheduleAdvance(() => goToNextExchange());
      return;
    }

    scheduleAdvance(() => goToNextExchange());
  }

  function handleEasySelect(option: EasyWordOption) {
    if (!currentExchange || exchangeStep !== "question") return;
    setEasySelected(option);
    const correct = option.isCorrect;
    recordResult(currentExchange, correct);
    scheduleAdvance(() => afterFeedback(currentExchange));
  }

  function handleMediumSelect(option: MediumSentenceOption) {
    if (!currentExchange || exchangeStep !== "question") return;
    recordResult(currentExchange, option.isCorrect);
    scheduleAdvance(() => afterFeedback(currentExchange));
  }

  function handleHardCheck() {
    if (!currentExchange || exchangeStep !== "question" || hardBuilt.length === 0) return;
    const correct = hardAnswerMatches(
      hardBuilt.map((tile) => tile.word),
      currentExchange.hard_word_tiles
    );
    recordResult(currentExchange, correct);
    scheduleAdvance(() => afterFeedback(currentExchange));
  }

  function moveHardToBuilt(tile: SentenceTile) {
    if (exchangeStep !== "question") return;
    setHardBank((prev) => prev.filter((item) => item.id !== tile.id));
    setHardBuilt((prev) => [...prev, tile]);
  }

  function moveHardToBank(tile: SentenceTile) {
    if (exchangeStep !== "question") return;
    setHardBuilt((prev) => prev.filter((item) => item.id !== tile.id));
    setHardBank((prev) => [...prev, tile]);
  }

  function resetToCharacters() {
    setPlayPhase(null);
    setSetupPhase("characters");
    setSelectedCharacterId(null);
    setSelectedScenarioId(null);
    setDifficulty(null);
    setTranscript([]);
  }

  if (!tableReady) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Run <code className="text-xs">supabase/conversation-practice.sql</code> to enable this
        game.
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Could not load conversation content: {loadError}
      </div>
    );
  }

  if (playPhase === "finished" && selectedScenario) {
    return (
      <GameSessionReview
        title="Conversation complete"
        correct={correctCount}
        total={exchanges.length}
        sessionLog={[]}
        pointsEarned={pointsEarned}
        scoreSubtitle={`${correctCount} out of ${exchanges.length} exchanges correct`}
        onPlayAgain={resetToCharacters}
      />
    );
  }

  if (playPhase === "playing" && selectedCharacter && currentExchange && difficulty) {
    const hardCorrectTiles = currentExchange.hard_word_tiles
      .filter((tile) => !tile.is_distractor)
      .sort((a, b) => a.correct_position - b.correct_position);
    const easyRomanisedTemplate =
      difficulty === "easy" ? buildEasyRomanisedBlankTemplate(currentExchange) : null;
    const easyRomanisedFilled =
      easyRomanisedTemplate && difficulty === "easy"
        ? fillEasyBlank(
            easyRomanisedTemplate,
            easyRomanisedWordForDisplay(currentExchange, easySelected, exchangeStep)
          )
        : null;

    return (
      <div className="flex min-h-[calc(100dvh-7rem)] flex-col">
        <ConversationPlayHeader
          exchangeIndex={exchangeIndex}
          totalExchanges={exchanges.length}
          correctCount={correctCount}
        />

        <ConversationTranscript entries={transcript} character={selectedCharacter} />

        <div className="mt-3 shrink-0 space-y-4 border-t border-zinc-200 bg-white pt-4">
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Your task
          </p>
          <p className="mt-1 text-sm font-medium text-violet-950">
            {currentExchange.prompt_instruction}
          </p>
        </div>

        {difficulty === "easy" && (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-lg font-semibold leading-relaxed text-zinc-900">
                {fillEasyBlank(
                  currentExchange.easy_blank_template_gurmukhi,
                  exchangeStep === "question"
                    ? easySelected?.gurmukhi ?? null
                    : easySelected?.isCorrect
                      ? easySelected.gurmukhi
                      : currentExchange.easy_correct_word_gurmukhi
                )}
              </p>
              {easyRomanisedFilled ? (
                <p className="mt-2 text-base leading-relaxed text-violet-600">
                  {easyRomanisedFilled}
                </p>
              ) : null}
            </div>
            {exchangeStep === "question" ? (
              <div className="grid grid-cols-2 gap-2">
                {easyOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleEasySelect(option)}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-left text-sm font-medium text-zinc-900 hover:border-violet-300"
                  >
                    {option.gurmukhi}
                    {option.romanised ? (
                      <span className="mt-0.5 block text-xs text-violet-600">{option.romanised}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {difficulty === "medium" && exchangeStep === "question" && (
          <div className="space-y-2">
            {mediumOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleMediumSelect(option)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left hover:border-violet-300"
              >
                <p className="font-medium text-zinc-900">{option.gurmukhi}</p>
                {option.romanised ? (
                  <p className="text-sm text-violet-600">{option.romanised}</p>
                ) : null}
              </button>
            ))}
          </div>
        )}

        {difficulty === "hard" && (
          <div className="space-y-3">
            <div
              className={`min-h-16 rounded-xl border-2 border-dashed p-3 ${
                exchangeStep === "feedback"
                  ? lastCorrect
                    ? "border-green-300 bg-green-50"
                    : "border-red-300 bg-red-50"
                  : "border-violet-200 bg-violet-50/50"
              }`}
            >
              <div className="flex flex-wrap gap-2">
                {exchangeStep === "feedback" && !lastCorrect
                  ? hardCorrectTiles.map((tile) => (
                      <span
                        key={`${tile.gurmukhi}-${tile.correct_position}`}
                        className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white"
                      >
                        <span>{tile.gurmukhi}</span>
                        {tile.romanised ? (
                          <span className="mt-0.5 block text-xs font-normal text-violet-200">
                            {tile.romanised}
                          </span>
                        ) : null}
                      </span>
                    ))
                  : hardBuilt.map((tile) => (
                      <button
                        key={tile.id}
                        type="button"
                        onClick={() => moveHardToBank(tile)}
                        disabled={exchangeStep !== "question"}
                        className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-80"
                      >
                        <span>{tile.word}</span>
                        {tile.romanised ? (
                          <span className="mt-0.5 block text-xs font-normal text-violet-200">
                            {tile.romanised}
                          </span>
                        ) : null}
                      </button>
                    ))}
              </div>
            </div>

            {exchangeStep === "question" && (
              <>
                <div className="flex flex-wrap gap-2">
                  {hardBank.map((tile) => (
                    <button
                      key={tile.id}
                      type="button"
                      onClick={() => moveHardToBuilt(tile)}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:border-violet-300"
                    >
                      <span>{tile.word}</span>
                      {tile.romanised ? (
                        <span className="mt-0.5 block text-xs font-normal text-violet-600">
                          {tile.romanised}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleHardCheck}
                  disabled={hardBuilt.length === 0}
                  className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:bg-zinc-300"
                >
                  Check
                </button>
              </>
            )}
          </div>
        )}

        {exchangeStep === "feedback" && (
          <div
            className={`rounded-xl px-4 py-3 text-center text-sm font-medium ${
              lastCorrect
                ? "border border-green-200 bg-green-50 text-green-800"
                : "border border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {lastCorrect ? "Nice — that works!" : "Not quite — here's the reply:"}
            {!lastCorrect && (
              <p className="mt-2 font-semibold text-zinc-900">
                {currentExchange.target_response_gurmukhi}
              </p>
            )}
            {!lastCorrect && currentExchange.target_response_romanised ? (
              <p className="text-violet-600">{currentExchange.target_response_romanised}</p>
            ) : null}
          </div>
        )}

        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SetupHeader
        setupPhase={setupPhase}
        character={selectedCharacter}
        scenario={selectedScenario}
        onBack={() => {
          if (setupPhase === "scenarios") setSetupPhase("characters");
          if (setupPhase === "difficulty") setSetupPhase("scenarios");
        }}
      />

      {setupPhase === "characters" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {characters.map((character) => (
            <button
              key={character.id}
              type="button"
              onClick={() => {
                setSelectedCharacterId(character.id);
                setSelectedScenarioId(null);
                setSetupPhase("scenarios");
              }}
              className="rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50/40"
            >
              <p className="text-2xl" aria-hidden="true">
                {getConversationCharacterEmoji(character.icon_name)}
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-900">{character.name}</p>
              <p className="text-sm text-violet-600">{character.role}</p>
              {character.description ? (
                <p className="mt-2 text-sm text-zinc-500">{character.description}</p>
              ) : null}
            </button>
          ))}
          {characters.length === 0 ? (
            <p className="text-sm text-zinc-500">No characters available yet.</p>
          ) : null}
        </div>
      )}

      {setupPhase === "scenarios" && selectedCharacter && (
        <div className="space-y-3">
          {characterScenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => {
                setSelectedScenarioId(scenario.id);
                setSetupPhase("difficulty");
              }}
              className="w-full rounded-xl border border-zinc-200 bg-white px-5 py-4 text-left shadow-sm hover:border-violet-300"
            >
              <p className="font-semibold text-zinc-900">{scenario.title}</p>
              {scenario.description ? (
                <p className="mt-1 text-sm text-zinc-500">{scenario.description}</p>
              ) : null}
              {(exchangesByScenario[scenario.id] ?? []).length === 0 ? (
                <p className="mt-2 text-xs text-amber-700">Content coming soon</p>
              ) : (
                <p className="mt-2 text-xs text-zinc-400">
                  {(exchangesByScenario[scenario.id] ?? []).length} exchanges
                </p>
              )}
            </button>
          ))}
          {characterScenarios.length === 0 ? (
            <p className="text-sm text-zinc-500">No scenarios for this character yet.</p>
          ) : null}
        </div>
      )}

      {setupPhase === "difficulty" && selectedScenario && (
        <div className="space-y-4">
          {(exchangesByScenario[selectedScenario.id] ?? []).length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This scenario&apos;s conversation script is still being prepared — check back soon.
            </p>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Choose difficulty
              </p>
              <div className="space-y-2">
                {CONVERSATION_DIFFICULTIES.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => startScenario(level)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-5 py-4 text-left hover:border-violet-400 hover:bg-violet-50/50"
                  >
                    <p className="font-semibold text-zinc-900">
                      {CONVERSATION_DIFFICULTY_LABELS[level]}
                    </p>
                    <p className="text-sm text-zinc-500">
                      {CONVERSATION_DIFFICULTY_DESCRIPTIONS[level]}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ConversationPlayHeader({
  exchangeIndex,
  totalExchanges,
  correctCount,
}: {
  exchangeIndex: number;
  totalExchanges: number;
  correctCount: number;
}) {
  const progressPct =
    totalExchanges > 0 ? Math.min(100, ((exchangeIndex + 1) / totalExchanges) * 100) : 0;

  return (
    <header className="mb-3 shrink-0 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <BackLink fallbackHref={GAMES_HUB_HREF} className="text-sm font-medium text-violet-600 hover:text-violet-500">← Exit</BackLink>
        <p className="text-right text-xs font-medium text-zinc-600 sm:text-sm">
          Exchange {exchangeIndex + 1} of {totalExchanges}
          <span className="mx-1.5 text-zinc-300" aria-hidden="true">
            ·
          </span>
          <span className="text-violet-700">{correctCount} correct</span>
        </p>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-zinc-100"
        role="progressbar"
        aria-valuenow={exchangeIndex + 1}
        aria-valuemin={1}
        aria-valuemax={totalExchanges}
        aria-label={`Exchange ${exchangeIndex + 1} of ${totalExchanges}`}
      >
        <div
          className="h-full rounded-full bg-violet-600 transition-all duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </header>
  );
}

function SetupHeader({
  setupPhase,
  character,
  scenario,
  onBack,
}: {
  setupPhase: SetupPhase;
  character: ConversationCharacter | null;
  scenario: ConversationScenario | null;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        {setupPhase !== "characters" ? (
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium text-violet-600 hover:text-violet-500"
          >
            ← Back
          </button>
        ) : (
          <BackLink fallbackHref={GAMES_HUB_HREF} className="text-sm font-medium text-violet-600 hover:text-violet-500">← Back to games</BackLink>
        )}
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
        {CONVERSATION_PRACTICE_DISPLAY_NAME}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-zinc-900">
        {setupPhase === "characters" && "Pick a character"}
        {setupPhase === "scenarios" && character?.name}
        {setupPhase === "difficulty" && scenario?.title}
      </h1>
      {setupPhase === "scenarios" && character?.role ? (
        <p className="mt-1 text-sm text-zinc-500">{character.role}</p>
      ) : null}
      {setupPhase === "difficulty" && scenario?.description ? (
        <p className="mt-1 text-sm text-zinc-500">{scenario.description}</p>
      ) : null}
    </div>
  );
}
