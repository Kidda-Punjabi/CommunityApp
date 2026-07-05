"use client";

import { BackLink } from "@/components/navigation/back-link";
import { useCallback, useEffect, useRef, useState } from "react";
import { GameSessionReview } from "@/components/games/game-session-review";
import { GameSessionSettings } from "@/components/games/game-session-settings";
import { SessionProgressBar } from "@/components/session-progress-bar";
import { PointsEarnedBadge } from "@/components/points/points-earned-badge";
import { formatPunjabiForDisplay } from "@/lib/conjugation/format";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import { saveGameScore } from "@/lib/games/game-scores";
import { buildGameAccuracyMetadata } from "@/lib/leaderboard/points";
import {
  buildSpeakingPracticeRound,
  matchSpeakingTranscript,
  passedSpeakingAttempt,
  SPEAKING_PRACTICE_PASS_THRESHOLD,
  type SpeakingPracticeAttempts,
  type SpeakingPracticeCard,
} from "@/lib/games/speaking-practice";
import { normalizeSpeechTranscript } from "@/lib/games/voice-practice";
import type { GameSessionSettingsChoice } from "@/lib/games/session-settings";
import { VOICE_PRACTICE_MAX_ATTEMPTS } from "@/lib/games/voice-practice";
import { createClient } from "@/lib/supabase/client";

const ADVANCE_MS = 1400;
const MAX_RECORDING_MS = 8000;

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

type SpeakingPracticeModeProps = {
  cards: SpeakingPracticeCard[];
  initialAttempts: SpeakingPracticeAttempts;
  tableReady: boolean;
  loadError: string | null;
};

function pickRecorderMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function SpeakingPracticeMode({
  cards,
  initialAttempts,
  tableReady,
  loadError,
}: SpeakingPracticeModeProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [roundCards, setRoundCards] = useState<SpeakingPracticeCard[]>([]);
  const [requestedCount, setRequestedCount] = useState(10);
  const [shortPoolNotice, setShortPoolNotice] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [passedCount, setPassedCount] = useState(0);
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
  const [lastPoints, setLastPoints] = useState(0);

  const userIdRef = useRef<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const stopTimerRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const mediaSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const current = roundCards[questionIndex];
  const totalQuestions = roundCards.length;
  const canStart =
    tableReady && cards.length > 0 && mediaSupported && monthlyAttempts.remaining > 0;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    return () => {
      stopRecording();
      if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    };
  }, []);

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

  function scheduleAdvance(passed: boolean) {
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = window.setTimeout(() => {
      advanceQuestion(passed);
    }, ADVANCE_MS);
  }

  function advanceQuestion(passed: boolean) {
    const nextPassed = passedCount + (passed ? 1 : 0);

    if (questionIndex + 1 >= roundCards.length) {
      setPassedCount(nextPassed);
      setPhase("finished");
      return;
    }

    setPassedCount(nextPassed);
    setQuestionIndex((index) => index + 1);
    setAttempts(0);
    setBestSimilarity(0);
    setLastTranscript(null);
    setFeedback(null);
    setMicError(null);
    setLastPoints(0);
  }

  function startRound(choice: GameSessionSettingsChoice) {
    const round = buildSpeakingPracticeRound(cards, choice);
    if (round.cards.length === 0) return;

    setRoundCards(round.cards);
    setRequestedCount(round.requestedCount);
    setShortPoolNotice(
      round.cards.length < round.requestedCount
        ? `Only ${round.cards.length} word${round.cards.length === 1 ? "" : "s"} available — you'll practise ${round.cards.length}.`
        : null
    );
    setQuestionIndex(0);
    setPassedCount(0);
    setAttempts(0);
    setBestSimilarity(0);
    setLastTranscript(null);
    setFeedback(null);
    setMicError(null);
    setLimitMessage(null);
    setLastPoints(0);
    setPhase("playing");
  }

  async function persistCorrectAttempt(
    card: SpeakingPracticeCard,
    transcript: string,
    matchScore: number
  ) {
    const userId = userIdRef.current;
    if (!userId) return;

    const supabase = createClient();
    const outcome = await saveGameScore(supabase, userId, "speaking_practice", matchScore, {
      transcript,
      target: card.romanised,
      match_score: matchScore,
      flashcard_id: card.id,
      english: card.english,
      punjabi: card.punjabi,
      ...buildGameAccuracyMetadata(1, 1),
    });
    setPointsEarned((total) => total + outcome.pointsEarned);
    setLastPoints(outcome.pointsEarned);
  }

  async function handleRecordingComplete(blob: Blob) {
    if (!current) return;

    setUploading(true);
    setMicError(null);

    try {
      const body = new FormData();
      body.append("audio", blob, "recording.webm");
      body.append("flashcard_id", current.id);
      body.append("target_romanised", current.romanised);
      body.append("target_punjabi", current.punjabi);

      const response = await fetch("/api/speaking-practice/transcribe", {
        method: "POST",
        body,
      });

      const payload = (await response.json()) as TranscribeResponse;

      if (payload.limitReached || payload.allowed === false) {
        setLimitMessage(
          payload.message ??
            "You've used all your speaking practice transcriptions for this month. Come back next month!"
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

      const transcript = payload.transcript ?? "";
      const displayTranscript = normalizeSpeechTranscript(transcript) || transcript;
      const similarity = matchSpeakingTranscript(transcript, {
        romanised: current.romanised,
        punjabi: current.punjabi,
      });
      const nextAttempts = attempts + 1;
      const nextBest = Math.max(bestSimilarity, similarity);

      setAttempts(nextAttempts);
      setBestSimilarity(nextBest);
      setLastTranscript(displayTranscript);

      if (passedSpeakingAttempt(similarity)) {
        setFeedback("pass");
        void persistCorrectAttempt(current, transcript, similarity);
        scheduleAdvance(true);
        return;
      }

      if (nextAttempts >= VOICE_PRACTICE_MAX_ATTEMPTS) {
        setFeedback("failed");
        scheduleAdvance(false);
        return;
      }

      setFeedback("retry");
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
        "You've used all 60 speaking practice transcriptions for this month. Come back next month!"
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
      setMicError("Microphone access is required for Speaking Practice.");
      stopStream();
      setRecording(false);
    }
  }

  if (phase === "ready") {
    return (
      <GameSessionSettings
        gameTitle="Speaking Practice"
        gameEyebrow="Pronunciation"
        gameDescription="See a word or phrase, tap record, and speak it in Punjabi. We'll check your pronunciation."
        filterLabel="Deck"
        filterOptions={[{ id: "all", label: "All vocabulary" }]}
        poolSizeForFilter={() => cards.length}
        repeatPolicy="cap"
        repeatUnit="noun"
        canStart={canStart}
        extraSettings={
          <p className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-900">
            <span className="font-semibold">{monthlyAttempts.remaining}</span> speaking practice
            attempt{monthlyAttempts.remaining === 1 ? "" : "s"} left this month
            <span className="text-violet-600"> (resets {monthlyAttempts.monthKey})</span>
          </p>
        }
        unavailableMessage={
          !mediaSupported ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Your browser does not support audio recording. Try Chrome or Firefox on a device with a
              microphone.
            </div>
          ) : monthlyAttempts.remaining <= 0 ? (
            <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-900">
              You&apos;ve used all 60 speaking practice transcriptions for this month. Come back
              next month — your counter resets on the 1st.
            </div>
          ) : !tableReady ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Run <code className="text-xs">supabase/speaking-practice.sql</code> to enable this
              game.
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {loadError}
            </div>
          ) : cards.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No vocabulary cards with romanisation are available yet.
            </div>
          ) : undefined
        }
        onStart={startRound}
      />
    );
  }

  if (phase === "finished") {
    return (
      <GameSessionReview
        title="Session complete"
        correct={passedCount}
        total={totalQuestions}
        sessionLog={[]}
        pointsEarned={pointsEarned}
        scoreSubtitle={`${passedCount} passed out of ${totalQuestions}`}
        onPlayAgain={() => setPhase("ready")}
      />
    );
  }

  const punjabiDisplay = current ? formatPunjabiForDisplay(current.punjabi) : "";

  return (
    <div className="space-y-5">
      <SessionProgressBar current={questionIndex + 1} total={roundCards.length} />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <BackLink
            fallbackHref={GAMES_HUB_HREF}
            className="text-sm font-medium text-violet-600 hover:text-violet-500"
          >
            ← Exit
          </BackLink>
          <p className="text-sm font-semibold text-zinc-900">{passedCount} passed</p>
        </div>

        <p className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-2.5 text-sm text-violet-900">
          <span className="font-semibold">{monthlyAttempts.remaining}</span> speaking practice
          attempt{monthlyAttempts.remaining === 1 ? "" : "s"} left this month
        </p>

        {shortPoolNotice ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {shortPoolNotice}
          </p>
        ) : null}

        {limitMessage ? (
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
            {limitMessage}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Say this in Punjabi
        </p>
        <p className="mt-3 text-base font-medium text-zinc-700">{current?.english}</p>
        <p className="mt-4 text-2xl font-semibold leading-relaxed text-zinc-900">{punjabiDisplay}</p>
        <p className="mt-2 text-sm text-violet-600">{current?.romanised}</p>
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
            {lastPoints > 0 ? <PointsEarnedBadge points={lastPoints} className="justify-center" /> : null}
          </div>
        ) : feedback === "failed" ? (
          <div className="space-y-2">
            <p className="text-lg font-semibold text-zinc-900">Target pronunciation</p>
            <p className="text-xl font-medium text-violet-700">{current?.romanised}</p>
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
              {bestSimilarity}% similarity — aim for {SPEAKING_PRACTICE_PASS_THRESHOLD}% or higher.
              {lastTranscript ? (
                <>
                  {" "}
                  Heard &ldquo;{lastTranscript}&rdquo;
                </>
              ) : null}
            </p>
            <p className="text-xs text-zinc-500">One more attempt for this word.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">
              Tap record, say the Punjabi word clearly, then tap stop.
            </p>
            <p className="text-xs text-zinc-500">
              Attempt {attempts + 1} of {VOICE_PRACTICE_MAX_ATTEMPTS} for this word
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
