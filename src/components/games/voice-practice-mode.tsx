"use client";

import { BackLink } from "@/components/navigation/back-link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FloatingSoundToggle } from "@/components/audio/floating-sound-toggle";
import { useAudioManager } from "@/lib/audio/audio-manager";
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
  formatHeardTranscript,
  isPlayableVoiceSentence,
  passedVoiceAttempt,
  romanisedHint,
  VOICE_PRACTICE_MAX_ATTEMPTS,
  VOICE_PRACTICE_PASS_THRESHOLD,
  type VoicePracticeQuestionResult,
} from "@/lib/games/voice-practice";
import {
  VOICE_PRACTICE_MONTHLY_LIMIT,
  type VoicePracticeAttempts,
} from "@/lib/games/voice-practice-stt";
import { matchSpeakingTranscript } from "@/lib/games/speaking-practice";
import { formatPunjabiForDisplay } from "@/lib/conjugation/format";
import { createClient } from "@/lib/supabase/client";

const ADVANCE_MS = 1400;
/** Sentences need more headroom than single-word Speaking Practice (8s). */
const MAX_RECORDING_MS = 12000;

type Phase = "ready" | "playing" | "finished";
type QuestionFeedback = "pass" | "retry" | "failed" | null;

type TranscribeResponse = {
  allowed?: boolean;
  limitReached?: boolean;
  message?: string;
  transcript?: string;
  remaining?: number;
  error?: string;
};

type VoicePracticeModeProps = {
  sentences: GrammarSentence[];
  initialAttempts: VoicePracticeAttempts;
  tableReady: boolean;
  loadError: string | null;
  catchupReturn?: string | null;
};

function pickRecorderMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function VoicePracticeMode({
  sentences,
  initialAttempts,
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
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [monthlyAttempts, setMonthlyAttempts] = useState(initialAttempts);
  const [pointsEarned, setPointsEarned] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const stopTimerRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);
  const { playSound } = useAudioManager();

  const mediaSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

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
  const canStart =
    tableReady &&
    playableSentences.length > 0 &&
    mediaSupported &&
    monthlyAttempts.remaining > 0;

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

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    } else {
      stopStream();
      setRecording(false);
    }
  }, [stopStream]);

  useEffect(() => {
    return () => {
      stopRecording();
      if (advanceTimerRef.current) {
        window.clearTimeout(advanceTimerRef.current);
      }
    };
  }, [stopRecording]);

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
    setLimitMessage(null);
    setPhase("playing");
  }

  function handleTranscript(transcript: string) {
    if (!current || feedback === "pass" || feedback === "failed") return;

    // Score against both romanised + Gurmukhi — Scribe returns either script.
    // Use the same "heard" string we show the user so visible matches score high.
    const displayTranscript = formatHeardTranscript(transcript) || transcript.trim();
    const romanised = romanisedHint(current) ?? "";
    const similarity = Math.max(
      matchSpeakingTranscript(displayTranscript, {
        romanised,
        punjabi: current.punjabi_sentence,
      }),
      matchSpeakingTranscript(transcript, {
        romanised,
        punjabi: current.punjabi_sentence,
      })
    );
    const nextAttempts = attempts + 1;
    const nextBest = Math.max(bestSimilarity, similarity);

    setAttempts(nextAttempts);
    setBestSimilarity(nextBest);
    setLastTranscript(displayTranscript);

    if (passedVoiceAttempt(similarity)) {
      playSound("correct");
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
      playSound("incorrect");
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

  async function handleRecordingComplete(blob: Blob) {
    if (!current) return;

    setUploading(true);
    setMicError(null);

    try {
      const body = new FormData();
      body.append("audio", blob, "recording.webm");
      body.append("sentence_id", current.id);
      body.append("target_romanised", romanisedHint(current) ?? "");
      body.append("target_punjabi", current.punjabi_sentence);

      const response = await fetch("/api/voice-practice/transcribe", {
        method: "POST",
        body,
      });

      const payload = (await response.json()) as TranscribeResponse;

      if (payload.limitReached || payload.allowed === false) {
        setLimitMessage(
          payload.message ??
            `You've used all ${VOICE_PRACTICE_MONTHLY_LIMIT} Speak It transcriptions for this month. Come back next month!`
        );
        setMonthlyAttempts((prev) => ({ ...prev, remaining: 0, used: prev.limit }));
        return;
      }

      if (!response.ok || payload.error) {
        setMicError(payload.error ?? "Could not transcribe your recording. Please try again.");
        return;
      }

      if (typeof payload.remaining === "number") {
        setMonthlyAttempts((prev) => ({
          ...prev,
          remaining: payload.remaining!,
          used: prev.limit - payload.remaining!,
        }));
      }

      handleTranscript(payload.transcript ?? "");
    } catch {
      setMicError("Something went wrong sending your recording. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function startRecording() {
    if (!current || recording || uploading || feedback === "pass" || feedback === "failed") {
      return;
    }
    if (monthlyAttempts.remaining <= 0) {
      setLimitMessage(
        `You've used all ${VOICE_PRACTICE_MONTHLY_LIMIT} Speak It transcriptions for this month. Come back next month!`
      );
      return;
    }

    setMicError(null);
    if (feedback === "retry") {
      setFeedback(null);
      setLastTranscript(null);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        setRecording(false);
        stopStream();
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        recorderRef.current = null;
        void handleRecordingComplete(blob);
      };

      recorder.onerror = () => {
        setMicError("Recording failed — check microphone permissions and try again.");
        stopRecording();
      };

      recorder.start();
      setRecording(true);

      stopTimerRef.current = window.setTimeout(() => {
        stopRecording();
      }, MAX_RECORDING_MS);
    } catch {
      setMicError("Microphone access is required for Speak It.");
      stopStream();
      setRecording(false);
    }
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
        extraSettings={
          <p className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-900">
            <span className="font-semibold">{monthlyAttempts.remaining}</span> Speak It
            transcription{monthlyAttempts.remaining === 1 ? "" : "s"} left this month
            <span className="text-violet-600"> (resets {monthlyAttempts.monthKey})</span>
          </p>
        }
        unavailableMessage={
          !mediaSupported ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This browser can&apos;t record audio. Try Safari, Chrome, or Edge on a supported device.
            </div>
          ) : monthlyAttempts.remaining <= 0 ? (
            <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-900">
              You&apos;ve used all {VOICE_PRACTICE_MONTHLY_LIMIT} Speak It transcriptions for this
              month. Come back next month — your counter resets on the 1st.
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
        tutorialId="voice_practice"
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

  return (
    <div className="relative space-y-5">
      <FloatingSoundToggle />
      <SessionProgressBar current={questionIndex + 1} total={questions.length} />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <BackLink
            fallbackHref={GAMES_HUB_HREF}
            className="text-sm font-medium text-violet-600 hover:text-violet-500"
          >
            ← Exit
          </BackLink>
          <p className="text-sm font-semibold text-zinc-900">
            {passedCount} passed · {monthlyAttempts.remaining} left this month
          </p>
        </div>
        {shortPoolNotice ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {shortPoolNotice}
          </p>
        ) : null}
        {limitMessage ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {limitMessage}
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
              Tap record, say the Punjabi sentence clearly, then tap stop.
            </p>
            <p className="text-xs text-zinc-500">
              Attempt {attempts + 1} of {VOICE_PRACTICE_MAX_ATTEMPTS} · up to{" "}
              {MAX_RECORDING_MS / 1000}s per recording
            </p>
          </div>
        )}

        {micError ? <p className="mt-3 text-sm text-red-600">{micError}</p> : null}

        {feedback !== "pass" && feedback !== "failed" && !limitMessage ? (
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={uploading || monthlyAttempts.remaining <= 0}
            className={`mt-4 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
              recording ? "bg-red-500 hover:bg-red-400" : "bg-violet-600 hover:bg-violet-500"
            }`}
          >
            <span aria-hidden="true">{recording ? "⏹" : uploading ? "⏳" : "🎙️"}</span>
            {uploading
              ? "Checking…"
              : recording
                ? "Stop recording"
                : feedback === "retry"
                  ? "Try again"
                  : "Record"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
