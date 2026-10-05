"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MicrophoneAccessNotice } from "@/components/audio/microphone-access-notice";
import { emojiForIcon } from "@/components/games/PictureMatch/emojiMap";
import { useAudioManager } from "@/lib/audio/audio-manager";
import {
  safePracticeMessage,
  type MicrophoneFailure,
} from "@/lib/audio/microphone-access-message";
import { startPracticeRecording } from "@/lib/audio/request-microphone";
import { useKidActivityComplete } from "@/components/kids/use-kid-activity-complete";
import {
  matchSpeakingTranscript,
  passedSpeakingAttempt,
  type SpeakingPracticeCard,
} from "@/lib/games/speaking-practice";
import { useRouter } from "next/navigation";

type KidSpeakingPracticeProps = {
  cards: SpeakingPracticeCard[];
};

export function KidSpeakingPractice({ cards }: KidSpeakingPracticeProps) {
  const router = useRouter();
  const { completeActivity, celebration } = useKidActivityComplete();
  const [index, setIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [feedback, setFeedback] = useState<"great" | "try" | null>(null);
  const [micFailure, setMicFailure] = useState<MicrophoneFailure | null>(null);
  const [finished, setFinished] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const { playSound } = useAudioManager();

  const card = cards[index];

  const cleanup = useCallback(() => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    streamRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  async function startRecording() {
    if (!card || recording) return;
    setFeedback(null);
    setMicFailure(null);
    const opened = await startPracticeRecording();
    if (!opened.ok) {
      setMicFailure(opened.failure);
      return;
    }
    const { stream, recorder } = opened;
    streamRef.current = stream;
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      setRecording(false);
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      try {
        const response = await fetch("/api/speaking-practice/transcribe", {
          method: "POST",
          body: form,
        });
        const data = (await response.json()) as {
          transcript?: string;
          allowed?: boolean;
          error?: string;
          message?: string;
        };
        if (!response.ok) {
          setMicFailure({
            kind: "message",
            message: safePracticeMessage(
              data.error ?? data.message,
              "Could not check your speech. Tap again to retry."
            ),
          });
          return;
        }
        if (data.allowed === false) {
          setFeedback("try");
          return;
        }
        const similarity = matchSpeakingTranscript(data.transcript ?? "", {
          romanised: card.romanised,
          punjabi: card.punjabi,
        });
        const passed = passedSpeakingAttempt(similarity);
        playSound(passed ? "correct" : "incorrect");
        setFeedback(passed ? "great" : "try");
        if (passed) {
          setTimeout(() => {
            if (index + 1 >= cards.length) {
              playSound("game_complete");
              setFinished(true);
              void completeActivity("speaking_practice", { words: cards.length });
            } else {
              setIndex((i) => i + 1);
              setFeedback(null);
            }
          }, 1200);
        }
      } catch {
        setMicFailure({
          kind: "message",
          message: "Could not check your speech. Tap again to retry.",
        });
      }
    };
    recorderRef.current = recorder;
    try {
      recorder.start();
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      setMicFailure({
        kind: "message",
        message: "We couldn't start the microphone. Tap again to retry.",
      });
      return;
    }
    setRecording(true);
    setTimeout(() => recorder.state === "recording" && recorder.stop(), 6000);
  }

  useEffect(() => {
    if (finished && !celebration) {
      router.push("/dashboard/kids");
    }
  }, [finished, celebration, router]);

  if (!card) {
    return <p className="text-center text-zinc-600">No words to practice yet.</p>;
  }

  return (
    <div className="text-center">
      <p className="text-lg font-bold text-sky-800">Listen, then say it!</p>
      <div className="mt-8 rounded-3xl bg-white p-8 shadow-lg">
        {card.iconName && (
          <p className="text-7xl" aria-hidden>
            {emojiForIcon(card.iconName)}
          </p>
        )}
        <p className="mt-4 text-3xl font-bold text-zinc-900">{card.english}</p>
      </div>

      <button
        type="button"
        onClick={() => void startRecording()}
        disabled={recording}
        className="mt-10 rounded-full bg-violet-500 px-10 py-5 text-xl font-bold text-white shadow-lg disabled:opacity-60"
      >
        {recording ? "Listening…" : "🎤 Tap to speak"}
      </button>

      {micFailure ? <MicrophoneAccessNotice failure={micFailure} /> : null}

      {feedback === "great" && (
        <p className="mt-6 text-2xl font-bold text-green-600">Wonderful!</p>
      )}
      {feedback === "try" && (
        <p className="mt-6 text-xl font-semibold text-amber-600">Let&apos;s try again!</p>
      )}

      {celebration}
    </div>
  );
}
