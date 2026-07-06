"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { emojiForIcon } from "@/components/games/PictureMatch/emojiMap";
import { useAudioManager } from "@/lib/audio/audio-manager";
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
    if (!card) return;
    setFeedback(null);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      setRecording(false);
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      const response = await fetch("/api/speaking-practice/transcribe", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as { transcript?: string; allowed?: boolean };
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
    };
    recorderRef.current = recorder;
    recorder.start();
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
