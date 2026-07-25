"use client";

import { useMemo, useRef, useState } from "react";
import type { FlashcardDeckCard } from "@/lib/flashcards/types";
import { TopicListenButton } from "@/components/learn/topic-listen-button";
import {
  flashcardToSpeakingCard,
  shuffleInPlace,
} from "@/lib/free-lessons/topic-game-utils";
import type { SpeakingPracticeCard } from "@/lib/games/speaking-practice";
import {
  matchSpeakingTranscript,
  passedSpeakingAttempt,
} from "@/lib/games/speaking-practice";
import {
  formatHeardTranscript,
  VOICE_PRACTICE_MAX_ATTEMPTS,
} from "@/lib/games/voice-practice";

type TopicSpeakActivityProps = {
  cards: FlashcardDeckCard[];
  itemCount: number;
  passThreshold: number;
  title: string;
  subtitle: string;
  onComplete: (result: { percent: number; correct: number; total: number }) => void;
};

function pickRecorderMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function TopicSpeakActivity({
  cards,
  itemCount,
  passThreshold,
  title,
  subtitle,
  onComplete,
}: TopicSpeakActivityProps) {
  const speakCards = useMemo(() => {
    const mapped = cards
      .map(flashcardToSpeakingCard)
      .filter((card): card is SpeakingPracticeCard => Boolean(card));
    return shuffleInPlace(mapped).slice(0, Math.min(itemCount, mapped.length));
  }, [cards, itemCount]);

  const audioById = useMemo(() => {
    const map = new Map<string, string>();
    for (const card of cards) {
      if (card.audioUrl) map.set(card.id, card.audioUrl);
    }
    return map;
  }, [cards]);

  const [index, setIndex] = useState(0);
  const passedCountRef = useRef(0);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<"pass" | "retry" | "failed" | null>(
    null
  );
  const [failAttempts, setFailAttempts] = useState(0);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const card = speakCards[index];

  function resetRoundState() {
    setFeedback(null);
    setTranscript(null);
    setMicError(null);
  }

  async function startRecording() {
    if (feedback === "pass" || recording || uploading) return;
    setMicError(null);
    if (feedback === "retry" || feedback === "failed") {
      setFeedback(null);
      setTranscript(null);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        void submitRecording(new Blob(chunksRef.current, { type: recorder.mimeType }));
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
          setRecording(false);
        }
      }, 8000);
    } catch {
      setMicError("Microphone permission is needed to practise speaking.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  async function submitRecording(blob: Blob) {
    if (!card) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("audio", blob, "take.webm");
      form.append("flashcard_id", card.id);
      form.append("target_punjabi", card.punjabi);
      form.append("target_romanised", card.romanised);
      const response = await fetch("/api/speaking-practice/transcribe", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as {
        transcript?: string;
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        setMicError(payload.error ?? payload.message ?? "Could not check your speech.");
        return;
      }
      const rawTranscript = payload.transcript ?? "";
      setTranscript(formatHeardTranscript(rawTranscript) || null);
      const match = matchSpeakingTranscript(rawTranscript, {
        romanised: card.romanised,
        punjabi: card.punjabi,
      });
      const ok = passedSpeakingAttempt(match);
      if (ok) {
        setFeedback("pass");
        passedCountRef.current += 1;
        return;
      }

      const nextFails = failAttempts + 1;
      setFailAttempts(nextFails);
      setFeedback(nextFails >= VOICE_PRACTICE_MAX_ATTEMPTS ? "failed" : "retry");
    } catch {
      setMicError("Could not check your speech. Try again.");
    } finally {
      setUploading(false);
    }
  }

  function goNext() {
    const nextIndex = index + 1;
    if (nextIndex >= speakCards.length) {
      const total = speakCards.length;
      const correct = passedCountRef.current;
      const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
      onComplete({ percent, correct, total });
      return;
    }
    setIndex(nextIndex);
    setFailAttempts(0);
    resetRoundState();
  }

  if (speakCards.length < 2) {
    return (
      <p className="text-center text-sm text-zinc-500">
        Speaking needs romanised phrases for this topic. Try Sentence tiles for now.
      </p>
    );
  }

  const audioUrl = audioById.get(card.id) ?? null;

  return (
    <div className="mx-auto max-w-md text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Speak it
      </p>
      <h1 className="mt-1 font-heading text-xl font-semibold text-zinc-900">{title}</h1>
      <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      <p className="mt-2 text-xs text-zinc-400">
        {index + 1} of {speakCards.length} · Pass at {passThreshold}%
      </p>

      <div className="mt-5 rounded-3xl border border-zinc-200 bg-white px-5 py-6 shadow-sm">
        <p className="text-sm text-zinc-500">{card.english}</p>
        <div className="mt-3 flex items-start justify-center gap-2">
          <p className="text-2xl font-semibold text-zinc-900">{card.punjabi}</p>
          {audioUrl ? (
            <TopicListenButton audioUrl={audioUrl} label="Play pronunciation" />
          ) : null}
        </div>
        <p className="mt-2 text-sm text-violet-600">{card.romanised}</p>

        {feedback === "pass" ? (
          <p className="mt-4 text-sm font-semibold text-emerald-600">Nice speaking!</p>
        ) : null}
        {feedback === "retry" ? (
          <div className="mt-4 space-y-1">
            <p className="text-sm font-semibold text-amber-700">Not quite — try again</p>
            <p className="text-xs text-zinc-500">
              Listen once, then take another go.
            </p>
          </div>
        ) : null}
        {feedback === "failed" ? (
          <div className="mt-4 space-y-1">
            <p className="text-sm font-semibold text-rose-600">Still not matching</p>
            <p className="text-xs text-zinc-500">
              Listen again, keep practising, or skip this one.
            </p>
          </div>
        ) : null}
        {transcript ? (
          <p className="mt-2 text-xs text-zinc-500">Heard: {transcript}</p>
        ) : null}
        {micError ? <p className="mt-2 text-sm text-rose-600">{micError}</p> : null}

        <div className="mt-6 flex flex-col gap-2">
          {feedback === "pass" ? (
            <button
              type="button"
              onClick={goNext}
              className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500"
            >
              {index + 1 < speakCards.length ? "Continue" : "See results"}
            </button>
          ) : feedback === "failed" ? (
            <>
              <button
                type="button"
                disabled={uploading}
                onClick={recording ? stopRecording : startRecording}
                className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
              >
                {uploading
                  ? "Checking…"
                  : recording
                    ? "Stop & check"
                    : "Try again"}
              </button>
              <button
                type="button"
                onClick={goNext}
                className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Skip
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={uploading}
              onClick={recording ? stopRecording : startRecording}
              className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
            >
              {uploading
                ? "Checking…"
                : recording
                  ? "Stop & check"
                  : feedback === "retry"
                    ? "Try again"
                    : "Tap to speak"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
