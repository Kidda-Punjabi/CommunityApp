"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ComprehensionScriptOverlay } from "@/components/comprehension/comprehension-script-overlay";
import { ComprehensionScriptViewer } from "@/components/comprehension/comprehension-script-viewer";
import { GameSessionReview } from "@/components/games/game-session-review";
import { SessionProgressBar } from "@/components/session-progress-bar";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import { saveGameScore } from "@/lib/games/game-scores";
import {
  COMPREHENSION_MODE_DESCRIPTIONS,
  COMPREHENSION_MODE_LABELS,
  COMPREHENSION_MODES,
  COMPREHENSION_PRACTICE_DISPLAY_NAME,
  type ComprehensionMode,
} from "@/lib/comprehension/config";
import type {
  ComprehensionPracticeContent,
  ComprehensionQuestion,
  ComprehensionQuestionOption,
  ComprehensionQuestionResult,
  ComprehensionScriptSummary,
  ComprehensionViewerPreferences,
} from "@/lib/comprehension/types";
import { defaultViewerPreferences, questionOptions } from "@/lib/comprehension/types";
import { createClient } from "@/lib/supabase/client";

const FEEDBACK_MS = 1000;

type Phase = "hub" | "mode" | "script" | "questions" | "finished";

type ComprehensionPracticeModeProps = ComprehensionPracticeContent;

export function ComprehensionPracticeMode({
  scripts,
  sentencesByScript,
  questionsByScript,
  tablesReady,
  loadError,
}: ComprehensionPracticeModeProps) {
  const [phase, setPhase] = useState<Phase>("hub");
  const [selectedScript, setSelectedScript] = useState<ComprehensionScriptSummary | null>(null);
  const [mode, setMode] = useState<ComprehensionMode>("reading");
  const [viewerPreferences, setViewerPreferences] = useState<ComprehensionViewerPreferences>(
    defaultViewerPreferences("reading")
  );
  const [scriptOverlayOpen, setScriptOverlayOpen] = useState(false);
  const [questions, setQuestions] = useState<ComprehensionQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [results, setResults] = useState<ComprehensionQuestionResult[]>([]);
  const [selectedOption, setSelectedOption] = useState<ComprehensionQuestionOption | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);

  const advanceTimerRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);

  const sentences = useMemo(
    () => (selectedScript ? (sentencesByScript[selectedScript.id] ?? []) : []),
    [selectedScript, sentencesByScript]
  );

  const currentQuestion = questions[questionIndex] ?? null;
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
    if (phase !== "finished" || savedRef.current || !selectedScript) return;
    savedRef.current = true;

    const total = questions.length;
    const correct = results.filter((result) => result.correct).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    const persist = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      const supabase = createClient();
      const outcome = await saveGameScore(supabase, userId, "comprehension_practice", correct, {
        accuracy,
        correct,
        total,
        script_id: selectedScript.id,
        mode_selected: mode,
        questions: results,
      });
      setPointsEarned(outcome.pointsEarned);
    };

    void persist();
  }, [phase, questions.length, results, selectedScript, mode]);

  function selectScript(script: ComprehensionScriptSummary) {
    setSelectedScript(script);
    setPhase("mode");
  }

  function chooseMode(nextMode: ComprehensionMode) {
    setMode(nextMode);
    setViewerPreferences(defaultViewerPreferences(nextMode));
    setPhase("script");
  }

  function startQuestions() {
    if (!selectedScript) return;
    const scriptQuestions = questionsByScript[selectedScript.id] ?? [];
    if (scriptQuestions.length === 0) return;

    savedRef.current = false;
    setQuestions(scriptQuestions);
    setQuestionIndex(0);
    setResults([]);
    setSelectedOption(null);
    setScriptOverlayOpen(false);
    setPhase("questions");
  }

  function handleAnswer(option: ComprehensionQuestionOption) {
    if (!currentQuestion || selectedOption) return;

    const correct = option === currentQuestion.correct_option;
    setSelectedOption(option);

    const result: ComprehensionQuestionResult = {
      question_id: currentQuestion.id,
      selected_option: option,
      correct,
    };

    advanceTimerRef.current = window.setTimeout(() => {
      const nextResults = [...results, result];
      if (questionIndex + 1 >= questions.length) {
        setResults(nextResults);
        setPhase("finished");
        return;
      }

      setResults(nextResults);
      setQuestionIndex((index) => index + 1);
      setSelectedOption(null);
    }, FEEDBACK_MS);
  }

  function resetToHub() {
    setPhase("hub");
    setSelectedScript(null);
    setScriptOverlayOpen(false);
    setQuestions([]);
    setQuestionIndex(0);
    setResults([]);
    setSelectedOption(null);
  }

  if (!tablesReady) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Run <code className="text-xs">supabase/comprehension-practice.sql</code> to enable this
        feature.
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Could not load comprehension content: {loadError}
      </div>
    );
  }

  if (phase === "finished" && selectedScript) {
    return (
      <GameSessionReview
        title="Comprehension complete"
        correct={correctCount}
        total={questions.length}
        sessionLog={[]}
        pointsEarned={pointsEarned}
        scoreSubtitle={`${COMPREHENSION_MODE_LABELS[mode]} · ${selectedScript.title}`}
        onPlayAgain={resetToHub}
      />
    );
  }

  if (phase === "questions" && selectedScript && currentQuestion) {
    const options = questionOptions(currentQuestion);

    return (
      <>
        <ComprehensionScriptOverlay
          open={scriptOverlayOpen}
          title={selectedScript.title}
          sentences={sentences}
          mode={mode}
          preferences={viewerPreferences}
          onPreferencesChange={setViewerPreferences}
          onClose={() => setScriptOverlayOpen(false)}
        />

        <div className="space-y-4">
          <SessionProgressBar current={questionIndex + 1} total={questions.length} />

          <div className="flex items-center justify-between gap-3">
            <Link
              href={GAMES_HUB_HREF}
              className="text-sm font-medium text-violet-600 hover:text-violet-500"
            >
              ← Exit
            </Link>
            <button
              type="button"
              onClick={() => setScriptOverlayOpen(true)}
              className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-800 hover:bg-violet-100"
            >
              View script
            </button>
          </div>

          <p className="text-sm font-semibold text-zinc-900">
            {questionIndex + 1} / {questions.length} · {correctCount} correct
          </p>

          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Comprehension question
            </p>
            <p className="mt-2 text-base font-medium leading-relaxed text-zinc-900">
              {currentQuestion.question_text}
            </p>
          </div>

          <div className="grid gap-2">
            {options.map((option) => {
              const isSelected = selectedOption === option.id;
              const isCorrect = option.id === currentQuestion.correct_option;
              const showResult = selectedOption !== null;

              let className =
                "rounded-xl border px-4 py-3 text-left text-sm transition-colors ";

              if (showResult) {
                if (isCorrect) {
                  className += "border-green-400 bg-green-50 text-green-900";
                } else if (isSelected) {
                  className += "border-red-300 bg-red-50 text-red-900";
                } else {
                  className += "border-zinc-200 bg-white opacity-60";
                }
              } else {
                className += "border-zinc-200 bg-white hover:border-violet-300 hover:bg-violet-50/40";
              }

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={showResult}
                  onClick={() => handleAnswer(option.id)}
                  className={className}
                >
                  <span className="font-semibold uppercase text-violet-600">{option.id}.</span>{" "}
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  if (phase === "script" && selectedScript) {
    const scriptQuestions = questionsByScript[selectedScript.id] ?? [];

    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setPhase("mode")}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back
        </button>

        <ComprehensionScriptViewer
          title={selectedScript.title}
          sentences={sentences}
          mode={mode}
          preferences={viewerPreferences}
          onPreferencesChange={setViewerPreferences}
          emphasizeAudio={mode !== "reading"}
        />

        {scriptQuestions.length > 0 ? (
          <button
            type="button"
            onClick={startQuestions}
            className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Start questions ({scriptQuestions.length})
          </button>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Questions for this script are still being prepared.
          </p>
        )}
      </div>
    );
  }

  if (phase === "mode" && selectedScript) {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => {
            setSelectedScript(null);
            setPhase("hub");
          }}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back to scripts
        </button>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            {COMPREHENSION_PRACTICE_DISPLAY_NAME}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">{selectedScript.title}</h1>
          {selectedScript.description ? (
            <p className="mt-1 text-sm text-zinc-500">{selectedScript.description}</p>
          ) : null}
        </div>

        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Choose how to practise
        </p>

        <div className="space-y-2">
          {COMPREHENSION_MODES.map((option) => {
            const needsAudio = option === "listening" || option === "both";
            const disabled = needsAudio && !selectedScript.listening_ready;

            return (
              <button
                key={option}
                type="button"
                disabled={disabled}
                onClick={() => chooseMode(option)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-5 py-4 text-left hover:border-violet-400 hover:bg-violet-50/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <p className="font-semibold text-zinc-900">{COMPREHENSION_MODE_LABELS[option]}</p>
                <p className="text-sm text-zinc-500">{COMPREHENSION_MODE_DESCRIPTIONS[option]}</p>
                {disabled ? (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    Recordings coming soon
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="text-sm text-zinc-500">
          Reading is always available. Listening requires every sentence to have a recording.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={GAMES_HUB_HREF}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back to games
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
          {COMPREHENSION_PRACTICE_DISPLAY_NAME}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">Choose a script</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Read or listen to a short passage, then answer comprehension questions.
        </p>
      </div>

      {scripts.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Scripts are being prepared — check back soon.
        </p>
      ) : (
        <div className="space-y-3">
          {scripts.map((script) => (
            <button
              key={script.id}
              type="button"
              onClick={() => selectScript(script)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-5 py-4 text-left shadow-sm hover:border-violet-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-900">{script.title}</p>
                  {script.description ? (
                    <p className="mt-1 text-sm text-zinc-500">{script.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-zinc-400">
                    {script.sentence_count} sentence{script.sentence_count === 1 ? "" : "s"}
                    {script.question_count > 0
                      ? ` · ${script.question_count} question${script.question_count === 1 ? "" : "s"}`
                      : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs">
                  {script.difficulty ? (
                    <p className="font-medium text-violet-700">Tier {script.difficulty}</p>
                  ) : null}
                  <p className="mt-1 text-zinc-500">
                    {script.listening_ready ? "Listening ready" : "Recordings coming soon"}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
