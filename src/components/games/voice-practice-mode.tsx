"use client";

import { BackLink } from "@/components/navigation/back-link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EnglishWithGenderMarkers } from "@/components/english-with-gender-markers";
import { GameSessionReview } from "@/components/games/game-session-review";
import { GameSessionSettings } from "@/components/games/game-session-settings";
import { SessionProgressBar } from "@/components/session-progress-bar";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import { filterGrammarSentencesByTenseValue } from "@/lib/games/grammar-sentence";
import { saveGameScore } from "@/lib/games/game-scores";
import type { GrammarSentence } from "@/lib/games/types";
import type { GameSessionSettingsChoice } from "@/lib/games/session-settings";
import {
  buildVoicePracticeRound,
  isPlayableVoiceSentence,
  passedVoiceAttempt,
  romanisedHint,
  speechSimilarityPercent,
  VOICE_PRACTICE_MAX_ATTEMPTS,
  VOICE_PRACTICE_PASS_THRESHOLD,
  type VoicePracticeQuestionResult,
} from "@/lib/games/voice-practice";
import { formatPunjabiForDisplay } from "@/lib/conjugation/format";
import {
  isSafariBrowser,
  isSpeechRecognitionSupported,
  SAFARI_VOICE_WARNING,
  SPEECH_UNSUPPORTED_MESSAGE,
} from "@/lib/speech/speech-recognition";
import {
  startPunjabiRecognitionSession,
  type PunjabiRecognitionSession,
} from "@/lib/speech/punjabi-recognition-session";
import { createClient } from "@/lib/supabase/client";

const ADVANCE_MS = 1400;

type Phase = "ready" | "playing" | "finished";
type QuestionFeedback = "pass" | "retry" | "failed" | null;

type VoicePracticeModeProps = {
  sentences: GrammarSentence[];
  tableReady: boolean;
  loadError: string | null;
  catchupReturn?: string | null;
};

export function VoicePracticeMode({
  sentences,
  catchupReturn = null,
  tableReady,
  loadError,
}: VoicePracticeModeProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [questions, setQuestions] = useState<GrammarSentence[]>([]);
  const [requestedCount, setRequestedCount] = useState(10);
  const [tenseFilter, setTenseFilter] = useState<string[]>(["mixed"]);
  const [shortPoolNotice, setShortPoolNotice] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [passedCount, setPassedCount] = useState(0);
  const [questionResults, setQuestionResults] = useState<VoicePracticeQuestionResult[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [bestSimilarity, setBestSimilarity] = useState(0);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<QuestionFeedback>(null);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);

  const sessionRef = useRef<PunjabiRecognitionSession | null>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);
  const speechSupported = useMemo(() => isSpeechRecognitionSupported(), []);
  const safariBrowser = useMemo(() => isSafariBrowser(), []);

  const playableSentences = useMemo(
    () => sentences.filter(isPlayableVoiceSentence),
    [sentences]
  );

  const availableTenseValues = useMemo(() => {
    const values = new Set<string>();
    for (const sentence of playableSentences) {
      if (sentence.tense?.trim()) values.add(sentence.tense.trim());
    }
    return [...values];
  }, [playableSentences]);

  const poolSizeForFilter = useCallback(
    (filterIds: string[]) =>
      filterGrammarSentencesByTenseValue(playableSentences, filterIds).length,
    [playableSentences]
  );

  const current = questions[questionIndex];
  const totalQuestions = questions.length;
  const canStart = tableReady && playableSentences.length > 0 && speechSupported;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    if (phase !== "finished" || savedRef.current) return;
    savedRef.current = true;

    const total = questions.length;
    const correct = questionResults.filter((result) => result.passed).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    const persist = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      const supabase = createClient();
      const outcome = await saveGameScore(supabase, userId, "voice_practice", correct, {
        accuracy,
        correct,
        total,
        question_count: requestedCount,
        tense_filter: tenseFilter,
        questions: questionResults,
      });
      setPointsEarned(outcome.pointsEarned);
    };

    void persist();
  }, [phase, questionResults, questions.length, requestedCount, tenseFilter]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        window.clearTimeout(advanceTimerRef.current);
      }
      sessionRef.current?.stop();
    };
  }, []);

  function stopRecognition() {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setListening(false);
  }

  function scheduleAdvance(result: VoicePracticeQuestionResult) {
    if (advanceTimerRef.current) {
      window.clearTimeout(advanceTimerRef.current);
    }

    advanceTimerRef.current = window.setTimeout(() => {
      advanceQuestion(result);
    }, ADVANCE_MS);
  }

  function advanceQuestion(result: VoicePracticeQuestionResult) {
    const nextResults = [...questionResults, result];
    const nextPassed = passedCount + (result.passed ? 1 : 0);

    if (questionIndex + 1 >= questions.length) {
      setQuestionResults(nextResults);
      setPassedCount(nextPassed);
      setPhase("finished");
      return;
    }

    setQuestionResults(nextResults);
    setPassedCount(nextPassed);
    setQuestionIndex((index) => index + 1);
    setAttempts(0);
    setBestSimilarity(0);
    setLastTranscript(null);
    setFeedback(null);
    setMicError(null);
  }

  function startRound(choice: GameSessionSettingsChoice) {
    savedRef.current = false;
    const round = buildVoicePracticeRound(sentences, choice);
    if (round.questions.length === 0) return;

    setQuestions(round.questions);
    setRequestedCount(round.requestedCount);
    setTenseFilter(round.tenseFilter);
    setShortPoolNotice(
      round.questions.length < round.requestedCount
        ? `Only ${round.questions.length} sentence${
            round.questions.length === 1 ? "" : "s"
          } match this selection — you'll play ${round.questions.length} question${
            round.questions.length === 1 ? "" : "s"
          }.`
        : null
    );
    setQuestionIndex(0);
    setPassedCount(0);
    setQuestionResults([]);
    setAttempts(0);
    setBestSimilarity(0);
    setLastTranscript(null);
    setFeedback(null);
    setMicError(null);
    setPhase("playing");
  }

  function handleTranscript(transcript: string) {
    if (!current || feedback === "pass" || feedback === "failed") return;

    const similarity = speechSimilarityPercent(transcript, current.punjabi_sentence);
    const nextAttempts = attempts + 1;
    const nextBest = Math.max(bestSimilarity, similarity);

    setAttempts(nextAttempts);
    setBestSimilarity(nextBest);
    setLastTranscript(transcript);

    if (passedVoiceAttempt(similarity)) {
      setFeedback("pass");
      scheduleAdvance({
        sentence_id: current.id,
        best_similarity: nextBest,
        passed: true,
        attempts: nextAttempts,
      });
      return;
    }

    if (nextAttempts >= VOICE_PRACTICE_MAX_ATTEMPTS) {
      setFeedback("failed");
      scheduleAdvance({
        sentence_id: current.id,
        best_similarity: nextBest,
        passed: false,
        attempts: nextAttempts,
      });
      return;
    }

    setFeedback("retry");
  }

  function startListening() {
    if (!current || listening || feedback === "pass" || feedback === "failed") return;

    setMicError(null);
    if (feedback === "retry") {
      setFeedback(null);
      setLastTranscript(null);
    }

    sessionRef.current?.stop();

    sessionRef.current = startPunjabiRecognitionSession({
      onTranscript: handleTranscript,
      onError: (message) => {
        setMicError(message);
        sessionRef.current = null;
      },
      onListeningChange: (active) => {
        setListening(active);
        if (!active) {
          sessionRef.current = null;
        }
      },
    });
  }

  if (phase === "ready") {
    return (
      <GameSessionSettings
        gameTitle="Speak It"
        gameEyebrow="Voice practice"
        gameDescription="Read each Punjabi sentence aloud. We'll score how closely your pronunciation matches."
        filterLabel="Tense"
        tenseFilterValues={availableTenseValues}
        poolSizeForFilter={poolSizeForFilter}
        repeatPolicy="cap"
        canStart={canStart}
        unavailableMessage={
          !speechSupported ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {SPEECH_UNSUPPORTED_MESSAGE}
            </div>
          ) : !tableReady ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Run <code className="text-xs">supabase/games.sql</code> to enable this game.
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              Could not load grammar sentences: {loadError}
            </div>
          ) : playableSentences.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No sentences available yet. More course content is coming soon.
            </div>
          ) : undefined
        }
        onStart={startRound}
      />
    );
  }

  if (phase === "finished") {
    const passed = questionResults.filter((result) => result.passed).length;

    return (
      <GameSessionReview
        title="Session complete"
        correct={passed}
        total={totalQuestions}
        sessionLog={[]}
        pointsEarned={pointsEarned}
        scoreSubtitle={`${passed} passed out of ${totalQuestions}`}
        onPlayAgain={() => setPhase("ready")}
        catchupReturn={catchupReturn}
      />
    );
  }

  const targetDisplay = current
    ? formatPunjabiForDisplay(current.punjabi_sentence)
    : "";
  const hintRomanised = current ? romanisedHint(current) : null;
  const revealAnswer = feedback === "failed";

  return (
    <div className="space-y-5">
      <SessionProgressBar current={questionIndex + 1} total={questions.length} />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <BackLink fallbackHref={GAMES_HUB_HREF} className="text-sm font-medium text-violet-600 hover:text-violet-500">← Exit</BackLink>
          <p className="text-sm font-semibold text-zinc-900">{passedCount} passed</p>
        </div>
        {shortPoolNotice ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {shortPoolNotice}
          </p>
        ) : null}
        {safariBrowser ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {SAFARI_VOICE_WARNING}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Say this in Punjabi
        </p>
        <EnglishWithGenderMarkers
          as="p"
          text={current?.english_translation ?? ""}
          className="mt-3 text-base font-medium text-zinc-700"
        />
        <p className="mt-4 text-2xl font-semibold leading-relaxed text-zinc-900">
          {targetDisplay}
        </p>
        {hintRomanised ? (
          <p className="mt-2 text-sm text-violet-600">{hintRomanised}</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-center shadow-sm">
        {feedback === "pass" ? (
          <div className="space-y-2">
            <p className="text-lg font-semibold text-green-700">Nice — that matched!</p>
            <p className="text-sm text-zinc-600">
              {bestSimilarity}% similarity
              {lastTranscript ? (
                <>
                  {" "}
                  · heard &ldquo;{lastTranscript}&rdquo;
                </>
              ) : null}
            </p>
          </div>
        ) : feedback === "failed" ? (
          <div className="space-y-2">
            <p className="text-lg font-semibold text-zinc-900">Here&apos;s the target sentence</p>
            <p className="text-xl font-medium text-violet-700">{targetDisplay}</p>
            {lastTranscript ? (
              <p className="text-sm text-zinc-500">
                Best match: {bestSimilarity}% · heard &ldquo;{lastTranscript}&rdquo;
              </p>
            ) : (
              <p className="text-sm text-zinc-500">Best match: {bestSimilarity}%</p>
            )}
          </div>
        ) : feedback === "retry" ? (
          <div className="space-y-2">
            <p className="text-lg font-semibold text-amber-700">Try again</p>
            <p className="text-sm text-zinc-600">
              {bestSimilarity}% similarity — aim for {VOICE_PRACTICE_PASS_THRESHOLD}% or higher.
              {lastTranscript ? (
                <>
                  {" "}
                  Heard &ldquo;{lastTranscript}&rdquo;
                </>
              ) : null}
            </p>
            <p className="text-xs text-zinc-500">One more attempt for this sentence.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">
              Tap record, then read the Punjabi sentence aloud clearly.
            </p>
            <p className="text-xs text-zinc-500">
              Attempt {attempts + 1} of {VOICE_PRACTICE_MAX_ATTEMPTS}
            </p>
          </div>
        )}

        {micError ? <p className="mt-3 text-sm text-red-600">{micError}</p> : null}

        {feedback !== "pass" && feedback !== "failed" ? (
          <button
            type="button"
            onClick={listening ? stopRecognition : startListening}
            disabled={revealAnswer}
            className={`mt-4 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-colors ${
              listening
                ? "bg-red-500 hover:bg-red-400"
                : "bg-violet-600 hover:bg-violet-500"
            }`}
          >
            <span aria-hidden="true">{listening ? "⏹" : "🎙️"}</span>
            {listening ? "Stop listening" : feedback === "retry" ? "Try again" : "Record"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
