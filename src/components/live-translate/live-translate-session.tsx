"use client";

import { BackLink } from "@/components/navigation/back-link";
import {
  photoCaptureInputClass,
  TranslatePrimaryButton,
} from "@/components/translate/translate-primary-button";
import { useContinuousVad } from "@/hooks/use-continuous-vad";
import type { LiveTranslateSide } from "@/lib/live-translate/config";
import { formatSecondsRemaining } from "@/lib/live-translate/month-key";
import type { LiveTranslateUsageSnapshot } from "@/lib/live-translate/usage";
import { useCallback, useEffect, useRef, useState } from "react";

type TurnMessage = {
  id: string;
  originalText: string;
  translatedText: string;
};

type ProcessedTurn = {
  member: TurnMessage | null;
  other: TurnMessage | null;
  audioBase64: string | null;
};

type ProcessTurnResponse = {
  original_text?: string;
  translated_text?: string;
  audio_base64?: string | null;
  seconds_remaining_this_month?: number;
  seconds_used_this_month?: number;
  resets_on?: string;
  message?: string;
  error?: string;
};

type LiveTranslateSessionProps = {
  initialUsage: LiveTranslateUsageSnapshot;
};

function playBase64Audio(base64: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("Could not play translated audio."));
    void audio.play().catch(reject);
  });
}

export function LiveTranslateSession({ initialUsage }: LiveTranslateSessionProps) {
  const [phase, setPhase] = useState<"ready" | "active">("ready");
  const [activeSide, setActiveSide] = useState<LiveTranslateSide>("member");
  const [usage, setUsage] = useState(initialUsage);
  const [memberTurns, setMemberTurns] = useState<TurnMessage[]>([]);
  const [otherTurns, setOtherTurns] = useState<TurnMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [processingTurn, setProcessingTurn] = useState(false);

  const activeSideRef = useRef(activeSide);
  const turnIdRef = useRef(0);
  const memberFeedRef = useRef<HTMLDivElement>(null);
  const otherFeedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeSideRef.current = activeSide;
  }, [activeSide]);

  useEffect(() => {
    memberFeedRef.current?.scrollTo({ top: memberFeedRef.current.scrollHeight, behavior: "smooth" });
  }, [memberTurns]);

  useEffect(() => {
    otherFeedRef.current?.scrollTo({ top: otherFeedRef.current.scrollHeight, behavior: "smooth" });
  }, [otherTurns]);

  const endSession = useCallback((message?: string) => {
    setPhase("ready");
    setStatusMessage(message ?? null);
    setMemberTurns([]);
    setOtherTurns([]);
    setActiveSide("member");
  }, []);

  const handleUtterance = useCallback(
    async ({ blob, durationSeconds }: { blob: Blob; durationSeconds: number }) => {
      if (phase !== "active") return;

      setProcessingTurn(true);
      setError(null);

      const formData = new FormData();
      formData.append("audio", blob, "utterance.webm");
      formData.append("active_side", activeSideRef.current);
      formData.append("duration_seconds", String(durationSeconds));

      try {
        const response = await fetch("/api/live-translate/process-turn", {
          method: "POST",
          body: formData,
        });
        const payload = (await response.json()) as ProcessTurnResponse;

        if (response.status === 429) {
          setUsage((current) => ({
            ...current,
            secondsRemaining: 0,
            secondsUsed: payload.seconds_used_this_month ?? current.capSeconds,
          }));
          endSession(
            payload.message ??
              `You've used your 15 minutes for this month. Resets on ${
                payload.resets_on ?? usage.resetsOn
              }.`
          );
          return;
        }

        if (!response.ok) {
          throw new Error(payload.error ?? payload.message ?? "Live Translate failed.");
        }

        const side = activeSideRef.current;
        turnIdRef.current += 1;
        const turnId = `turn-${turnIdRef.current}`;
        const originalText = payload.original_text ?? "";
        const translatedText = payload.translated_text ?? "";

        const processed: ProcessedTurn =
          side === "member"
            ? {
                member: { id: `${turnId}-member`, originalText, translatedText: "" },
                other: { id: `${turnId}-other`, originalText: "", translatedText },
                audioBase64: payload.audio_base64 ?? null,
              }
            : {
                member: { id: `${turnId}-member`, originalText: "", translatedText },
                other: { id: `${turnId}-other`, originalText, translatedText: "" },
                audioBase64: null,
              };

        if (processed.member?.originalText || processed.member?.translatedText) {
          setMemberTurns((current) => [...current, processed.member!]);
        }
        if (processed.other?.originalText || processed.other?.translatedText) {
          setOtherTurns((current) => [...current, processed.other!]);
        }

        if (typeof payload.seconds_remaining_this_month === "number") {
          setUsage((current) => ({
            ...current,
            secondsRemaining: payload.seconds_remaining_this_month ?? 0,
            secondsUsed:
              payload.seconds_used_this_month ??
              current.capSeconds - (payload.seconds_remaining_this_month ?? 0),
          }));
        }

        if (processed.audioBase64) {
          await playBase64Audio(processed.audioBase64);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Live Translate failed.");
      } finally {
        setProcessingTurn(false);
      }
    },
    [endSession, phase, usage.resetsOn]
  );

  const { listening, processing } = useContinuousVad({
    enabled: phase === "active" && usage.secondsRemaining > 0,
    onUtterance: handleUtterance,
    onError: setError,
  });

  function handleStart() {
    if (usage.secondsRemaining <= 0) {
      endSession(`You've used your 15 minutes for this month. Resets on ${usage.resetsOn}.`);
      return;
    }
    setError(null);
    setStatusMessage(null);
    setMemberTurns([]);
    setOtherTurns([]);
    setActiveSide("member");
    setPhase("active");
  }

  function handleEnd() {
    setError(null);
    setStatusMessage(null);
    setMemberTurns([]);
    setOtherTurns([]);
    setActiveSide("member");
    setPhase("ready");
  }

  if (phase === "ready") {
    return (
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-6">
          <div>
            <BackLink fallbackHref="/dashboard/home">← Back</BackLink>
            <h1 className="mt-4 text-2xl font-bold text-zinc-900">Live Translate</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Real-time Punjabi ↔ English for face-to-face conversations. Nothing is saved — end the
              session and it&apos;s gone.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
            {formatSecondsRemaining(usage.secondsRemaining)}
          </div>

          {usage.secondsRemaining <= 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              You&apos;ve used your 15 minutes for this month. Your allowance resets on {usage.resetsOn}.
            </p>
          ) : null}

          {statusMessage ? (
            <p className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
              {statusMessage}
            </p>
          ) : null}
        </div>

        <div className="relative z-[51] shrink-0 border-t border-zinc-200/80 bg-zinc-50/95 px-0 pb-1 pt-4 backdrop-blur-sm">
          <TranslatePrimaryButton
            disabled={usage.secondsRemaining <= 0}
            onActivate={handleStart}
          >
            Start conversation
          </TranslatePrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-zinc-950 text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Live Translate</p>
          <p className="text-xs text-zinc-400">
            {listening ? "Listening…" : "Starting mic…"}
            {processing || processingTurn ? " · Processing" : ""}
          </p>
        </div>
        <div className="text-right text-xs text-zinc-400">
          {formatSecondsRemaining(usage.secondsRemaining)}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-2">
        <section className="flex min-h-0 flex-col border-b border-white/10 bg-zinc-900">
          <div className="flex items-center justify-between px-4 py-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">You</p>
            <button
              type="button"
              onClick={() => setActiveSide("member")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                activeSide === "member" ? "bg-violet-600 text-white" : "bg-white/10 text-zinc-300"
              }`}
            >
              My turn
            </button>
          </div>
          <div ref={memberFeedRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
            {memberTurns.length === 0 ? (
              <p className="text-sm text-zinc-500">Speak English — Punjabi appears here with audio.</p>
            ) : (
              memberTurns.map((turn) => (
                <TurnBubble
                  key={turn.id}
                  turn={turn}
                  mode={turn.translatedText ? "translation" : "original"}
                />
              ))
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col bg-zinc-950">
          <div className="flex items-center justify-between px-4 py-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Other person
            </p>
            <button
              type="button"
              onClick={() => setActiveSide("other")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                activeSide === "other" ? "bg-emerald-600 text-white" : "bg-white/10 text-zinc-300"
              }`}
            >
              Their turn
            </button>
          </div>
          <div ref={otherFeedRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
            {otherTurns.length === 0 ? (
              <p className="text-sm text-zinc-500">They speak Punjabi — English appears here.</p>
            ) : (
              otherTurns.map((turn) => (
                <TurnBubble
                  key={turn.id}
                  turn={turn}
                  inverted
                  mode={turn.translatedText ? "translation" : "original"}
                />
              ))
            )}
          </div>
        </section>
      </div>

      {error ? (
        <p className="border-t border-red-500/30 bg-red-950/60 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {statusMessage ? (
        <p className="border-t border-amber-500/30 bg-amber-950/50 px-4 py-2 text-sm text-amber-100">
          {statusMessage}
        </p>
      ) : null}

      <footer className="border-t border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={handleEnd}
          className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white"
        >
          End conversation
        </button>
      </footer>
    </div>
  );
}

function TurnBubble({
  turn,
  inverted = false,
  mode,
}: {
  turn: TurnMessage;
  inverted?: boolean;
  mode: "original" | "translation";
}) {
  const text = mode === "original" ? turn.originalText : turn.translatedText;
  if (!text) return null;

  return (
    <article
      className={`rounded-2xl border border-white/10 bg-white/5 px-4 py-3 ${
        inverted ? "rotate-180" : ""
      }`}
    >
      <p
        className={
          mode === "original"
            ? "text-xs text-zinc-400"
            : "text-lg font-semibold leading-snug text-white"
        }
      >
        {text}
      </p>
    </article>
  );
}
