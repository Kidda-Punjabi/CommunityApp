"use client";

import { BackLink } from "@/components/navigation/back-link";
import { FloatingSoundToggle } from "@/components/audio/floating-sound-toggle";
import { GameSessionReview } from "@/components/games/game-session-review";
import { GameTutorialHost } from "@/components/games/tutorial/game-tutorial-host";
import { SessionProgressBar } from "@/components/session-progress-bar";
import { useAudioManager } from "@/lib/audio/audio-manager";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import { saveGameScore } from "@/lib/games/game-scores";
import {
  SOUND_MATCH_DISPLAY_NAME,
  SOUND_MATCH_FULL_ID,
  SOUND_MATCH_GROUPS,
  SOUND_MATCH_QUESTION_COUNTS,
  buildSoundMatchRound,
  isFullAlphabet,
  letterLabel,
  lettersForSelection,
  pairChoiceKey,
  pairChoiceLabel,
  pairingChoices,
  type SoundMatchLetter,
  type SoundMatchPairChoice,
  type SoundMatchQuestion,
  type SoundMatchQuestionResult,
  type SoundMatchSelectionId,
  type SoundMatchWordClip,
} from "@/lib/games/sound-match";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui/styles";
import { Volume2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const FEEDBACK_MS = 1100;

type Phase = "setup" | "playing" | "finished";
type SelectionMode = "group" | "pairing";

type SoundMatchModeProps = {
  letters: SoundMatchLetter[];
  words: SoundMatchWordClip[];
  loadError: string | null;
};

export function SoundMatchMode({ letters, words, loadError }: SoundMatchModeProps) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("group");
  const [selectedGroups, setSelectedGroups] = useState<SoundMatchSelectionId[]>([
    SOUND_MATCH_FULL_ID,
  ]);
  const [selectedPair, setSelectedPair] = useState<SoundMatchPairChoice | null>(null);
  const [questionCount, setQuestionCount] = useState<(typeof SOUND_MATCH_QUESTION_COUNTS)[number]>(
    10
  );
  const [questions, setQuestions] = useState<SoundMatchQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [results, setResults] = useState<SoundMatchQuestionResult[]>([]);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    selected: string;
    questionIndex: number;
  } | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);

  const advanceTimerRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { playSound } = useAudioManager();

  const current = questions[questionIndex];
  const correctCount = results.filter((result) => result.is_correct).length;
  const pairings = useMemo(() => pairingChoices(), []);
  const pairPool = selectedPair ? [selectedPair.left, selectedPair.right] : [];
  const groupPoolSize = lettersForSelection(selectedGroups).filter((glyph) =>
    letters.some((letter) => letter.glyph === glyph)
  ).length;
  const pairPoolSize = pairPool.filter((glyph) =>
    letters.some((letter) => letter.glyph === glyph && letter.audioUrl)
  ).length;
  const poolSize = selectionMode === "pairing" ? pairPoolSize : groupPoolSize;
  const selectedGroup = selectedPair
    ? SOUND_MATCH_GROUPS.find((group) => group.id === selectedPair.groupId)
    : null;

  const playCurrentAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current?.audioUrl) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Autoplay can fail until the student taps Replay.
    });
  }, [current?.audioUrl]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    setFeedback(null);
    playCurrentAudio();
  }, [phase, questionIndex, current?.audioUrl, current?.kind, playCurrentAudio]);

  useEffect(() => {
    if (phase !== "finished" || savedRef.current) return;
    savedRef.current = true;

    const persist = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      const total = questions.length;
      const correct = results.filter((result) => result.is_correct).length;
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
      const supabase = createClient();
      const outcome = await saveGameScore(supabase, userId, "sound_match", correct, {
        groups_selected: selectedGroups,
        selection_mode: selectionMode,
        pair_selected: selectedPair,
        question_count: total,
        correct_count: correct,
        correct,
        total,
        accuracy,
        per_question_results: results,
      });
      setPointsEarned(outcome.pointsEarned);
    };

    void persist();
  }, [phase, questions.length, results, selectedGroups, selectedPair, selectionMode]);

  function startRound() {
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    const nextQuestions = buildSoundMatchRound(
      letters,
      words,
      selectedGroups,
      questionCount,
      selectionMode === "pairing" && selectedPair ? pairPool : undefined,
      selectionMode === "pairing" ? selectedPair?.groupId : undefined
    );
    if (nextQuestions.length === 0) return;
    savedRef.current = false;
    setQuestions(nextQuestions);
    setQuestionIndex(0);
    setResults([]);
    setFeedback(null);
    setPointsEarned(0);
    setPhase("playing");
  }

  function toggleFullAlphabet() {
    setSelectedGroups([SOUND_MATCH_FULL_ID]);
  }

  function toggleGroup(id: Exclude<SoundMatchSelectionId, "full">) {
    setSelectedGroups((currentSelected) => {
      const withoutFull = currentSelected.filter((value) => value !== SOUND_MATCH_FULL_ID);
      if (withoutFull.includes(id)) {
        const next = withoutFull.filter((value) => value !== id);
        return next.length > 0 ? next : [SOUND_MATCH_FULL_ID];
      }
      return [...withoutFull, id];
    });
  }

  function chooseOption(option: string) {
    if (!current || feedback) return;

    const isCorrect = option === current.letter;
    playSound(isCorrect ? "correct" : "incorrect");

    const result: SoundMatchQuestionResult = {
      kind: current.kind,
      letter: current.letter,
      selected: option,
      options: current.options,
      is_correct: isCorrect,
      wordGurmukhi: current.wordGurmukhi,
      wordRomanised: current.wordRomanised,
    };

    setFeedback({ isCorrect, selected: option, questionIndex });

    advanceTimerRef.current = window.setTimeout(() => {
      const nextResults = [...results, result];
      setFeedback(null);
      if (questionIndex + 1 >= questions.length) {
        setResults(nextResults);
        setPhase("finished");
        return;
      }
      setResults(nextResults);
      setQuestionIndex((index) => index + 1);
    }, FEEDBACK_MS);
  }

  if (loadError || letters.length === 0) {
    return (
      <div className="space-y-4">
        <BackLink fallbackHref={GAMES_HUB_HREF}>← Games</BackLink>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError
            ? `Could not load Sound Match: ${loadError}`
            : "Sound Match letter audio is not ready yet."}
        </div>
      </div>
    );
  }

  if (phase === "setup") {
    const startDisabled =
      selectionMode === "pairing" ? !selectedPair || pairPoolSize !== 2 : poolSize === 0;
    const wordPool =
      selectionMode === "pairing" && selectedPair
        ? words.filter((word) => pairPool.includes(word.starting_letter))
        : words.filter((word) =>
            lettersForSelection(selectedGroups).includes(word.starting_letter)
          );

    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-start justify-between gap-3">
            <BackLink fallbackHref={GAMES_HUB_HREF}>← Back</BackLink>
            <GameTutorialHost tutorialId="sound_match" />
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
            Vocab game
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">{SOUND_MATCH_DISPLAY_NAME}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Hear a letter on its own, or at the start of a word, and pick it from similar sounds.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Number of questions
          </p>
          <div className="flex flex-wrap gap-2">
            {SOUND_MATCH_QUESTION_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setQuestionCount(count)}
                className={questionCount === count ? ui.pillActive : ui.pillInactive}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Choose letters
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectionMode("group")}
              className={selectionMode === "group" ? ui.pillActive : ui.pillInactive}
            >
              By group
            </button>
            <button
              type="button"
              onClick={() => setSelectionMode("pairing")}
              className={selectionMode === "pairing" ? ui.pillActive : ui.pillInactive}
            >
              By pairing
            </button>
          </div>
        </div>

        {selectionMode === "group" ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Letter groups
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleFullAlphabet}
                className={isFullAlphabet(selectedGroups) ? ui.pillActive : ui.pillInactive}
              >
                Full alphabet
              </button>
              {SOUND_MATCH_GROUPS.map((group) => {
                const active =
                  !isFullAlphabet(selectedGroups) && selectedGroups.includes(group.id);
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={active ? ui.pillActive : ui.pillInactive}
                  >
                    {group.label}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-zinc-500">
              {isFullAlphabet(selectedGroups)
                ? "Questions mix letter sounds and the start of words across all four confusable groups."
                : SOUND_MATCH_GROUPS.filter((group) => selectedGroups.includes(group.id))
                    .map((group) => group.description)
                    .join(" · ")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Similar-sound pairings
            </p>
            {SOUND_MATCH_GROUPS.filter((group) => group.pairs.length > 0).map((group) => (
              <div key={group.id} className="space-y-2">
                <p className="text-sm font-semibold text-zinc-800">{group.label}</p>
                <p className="text-xs text-zinc-500">{group.description}</p>
                <div className="flex flex-wrap gap-2">
                  {pairings
                    .filter((item) => item.group.id === group.id)
                    .map((item) => {
                      const choice: SoundMatchPairChoice = {
                        groupId: group.id,
                        left: item.left,
                        right: item.right,
                      };
                      const active =
                        selectedPair !== null &&
                        pairChoiceKey(selectedPair) === pairChoiceKey(choice);
                      return (
                        <button
                          key={pairChoiceKey(choice)}
                          type="button"
                          onClick={() => setSelectedPair(choice)}
                          className={active ? ui.pillActive : ui.pillInactive}
                        >
                          {pairChoiceLabel(item.left, item.right)}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
            <p className="text-sm text-zinc-500">
              {selectedPair && selectedGroup
                ? `This pairing is ${pairChoiceLabel(selectedPair.left, selectedPair.right)} — similar sounds from ${selectedGroup.label}. You'll hear each letter on its own and at the start of words.`
                : "Pick one pairing of similar letters. You don't choose the two letters separately."}
            </p>
          </div>
        )}

        {wordPool.length === 0 && poolSize > 0 ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Word clips aren't available for this selection yet, so this round will use letter sounds
            only.
          </p>
        ) : null}

        <button
          type="button"
          onClick={startRound}
          disabled={startDisabled}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Start
        </button>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <GameSessionReview
        title="Round complete"
        correct={correctCount}
        total={questions.length}
        sessionLog={results.map((result) => ({
          prompt:
            result.kind === "word" && result.wordGurmukhi
              ? result.wordGurmukhi
              : letterLabel(result.letter),
          promptRomanised:
            result.kind === "word" ? result.wordRomanised : undefined,
          userAnswer: letterLabel(result.selected),
          correctAnswer: letterLabel(result.letter),
          wasCorrect: result.is_correct,
        }))}
        pointsEarned={pointsEarned}
        onPlayAgain={() => setPhase("setup")}
      />
    );
  }

  return (
    <div className="relative space-y-3">
      <FloatingSoundToggle />
      <SessionProgressBar current={questionIndex + 1} total={questions.length} />
      {current ? <audio ref={audioRef} src={current.audioUrl} preload="auto" /> : null}

      <div className="flex items-center justify-between gap-3">
        <BackLink
          fallbackHref={GAMES_HUB_HREF}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Exit
        </BackLink>
        <div className="flex items-center gap-2">
          <GameTutorialHost tutorialId="sound_match" />
          <p className="text-sm font-semibold text-zinc-900">
            {questionIndex + 1} / {questions.length} · {correctCount} correct
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {SOUND_MATCH_DISPLAY_NAME}
          {current?.kind === "word" ? " · Word" : " · Letter"}
        </p>
        <p className="mt-2 text-center text-lg font-semibold text-zinc-900">
          {current?.kind === "word"
            ? "What does this word start with?"
            : "Which letter do you hear?"}
        </p>
        <p className="mt-1 text-center text-sm text-zinc-500">
          Audio plays automatically. Replay as many times as you need.
        </p>
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={playCurrentAudio} className={ui.btnSecondary}>
            <Volume2 className="mr-2 h-4 w-4" aria-hidden />
            Replay
          </button>
        </div>
      </div>

      <div className="grid gap-2">
        {current?.options.map((option) => {
          const showResult = feedback !== null && feedback.questionIndex === questionIndex;
          const isCorrectOption = option === current.letter;
          const isChosen = feedback?.selected === option;

          let className =
            "flex items-center justify-between rounded-xl border px-4 py-3 text-left ";
          if (showResult) {
            if (isCorrectOption) {
              className += "border-green-400 bg-green-50";
            } else if (isChosen) {
              className += "border-red-300 bg-red-50";
            } else {
              className += "border-zinc-200 bg-white opacity-60";
            }
          } else {
            className +=
              "border-zinc-200 bg-white hover:border-violet-300 hover:bg-violet-50/40";
          }

          return (
            <button
              key={`${questionIndex}-${option}`}
              type="button"
              disabled={showResult}
              onClick={() => chooseOption(option)}
              className={className}
            >
              <span className="text-lg font-semibold text-zinc-900">{letterLabel(option)}</span>
            </button>
          );
        })}
      </div>

      {feedback && feedback.questionIndex === questionIndex ? (
        <p
          className={`text-center text-sm font-medium ${
            feedback.isCorrect ? "text-green-700" : "text-amber-800"
          }`}
        >
          {feedback.isCorrect ? "Correct!" : `Not quite — ${letterLabel(current.letter)}`}
        </p>
      ) : null}
    </div>
  );
}
