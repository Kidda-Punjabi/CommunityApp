"use client";

import { BackLink } from "@/components/navigation/back-link";
import { TranslatePrimaryButton } from "@/components/translate/translate-primary-button";
import { useLiveTranslatePtt } from "@/hooks/use-live-translate-ptt";
import { containsGurmukhi } from "@/lib/conjugation/romanised";
import { formatSecondsRemaining } from "@/lib/live-translate/month-key";
import type { LiveTranslateSpokenLanguage } from "@/lib/live-translate/speech";
import type { LiveTranslateUsageSnapshot } from "@/lib/live-translate/usage";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";

type BubbleStage = "hearing" | "translating" | "speaking" | "done";

type ChatMessage = {
  id: string;
  spokenLanguage: LiveTranslateSpokenLanguage;
  originalText: string;
  translatedText: string;
  audioBase64: string | null;
  stage: BubbleStage;
};

type StreamEvent = {
  stage?: string;
  original_text?: string;
  translated_text?: string;
  audio_base64?: string | null;
  seconds_remaining_this_month?: number;
  seconds_used_this_month?: number;
  resets_on?: string;
  message?: string;
  error?: string;
  reason?: string;
};

type CapReachedPayload = {
  error?: string;
  message?: string;
  seconds_remaining_this_month?: number;
  seconds_used_this_month?: number;
  resets_on?: string;
};

type LiveTranslateSessionProps = {
  initialUsage: LiveTranslateUsageSnapshot;
};

async function readNdjsonStream(
  response: Response,
  onEvent: (event: StreamEvent) => void | Promise<void>
): Promise<void> {
  if (!response.body) {
    throw new Error("Live Translate stream was empty.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) {
        await onEvent(JSON.parse(line) as StreamEvent);
      }
      newlineIndex = buffer.indexOf("\n");
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    await onEvent(JSON.parse(trailing) as StreamEvent);
  }
}

export function LiveTranslateSession({ initialUsage }: LiveTranslateSessionProps) {
  const [phase, setPhase] = useState<"ready" | "active">("ready");
  const [usage, setUsage] = useState(initialUsage);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [processingTurn, setProcessingTurn] = useState(false);

  const turnIdRef = useRef(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const playBase64AudioRef = useRef<(base64: string) => Promise<void>>(async () => {});

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, processingTurn]);

  const playTranslatedAudio = useCallback(async (base64: string) => {
    try {
      await playBase64AudioRef.current(base64);
    } catch {
      // Autoplay may still fail on some browsers — bubble replay is the fallback.
    }
  }, []);

  const patchMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, ...patch } : message))
    );
  }, []);

  const handleClip = useCallback(
    async ({
      blob,
      durationSeconds,
      language,
    }: {
      blob: Blob;
      durationSeconds: number;
      language: LiveTranslateSpokenLanguage;
    }) => {
      if (phase !== "active") return;

      setProcessingTurn(true);
      setError(null);

      turnIdRef.current += 1;
      const messageId = `turn-${turnIdRef.current}`;
      setMessages((current) => [
        ...current,
        {
          id: messageId,
          spokenLanguage: language,
          originalText: "",
          translatedText: "",
          audioBase64: null,
          stage: "hearing",
        },
      ]);

      const formData = new FormData();
      formData.append("audio", blob, "utterance.webm");
      formData.append("language_code", language);
      formData.append("duration_seconds", String(durationSeconds));

      try {
        const response = await fetch("/api/live-translate/process-turn", {
          method: "POST",
          body: formData,
        });

        if (response.status === 429) {
          const payload = (await response.json()) as CapReachedPayload;
          setMessages((current) => current.filter((message) => message.id !== messageId));
          setUsage((current) => ({
            ...current,
            secondsRemaining: 0,
            secondsUsed: payload.seconds_used_this_month ?? current.capSeconds,
          }));
          setPhase("ready");
          setMessages([]);
          setStatusMessage(
            payload.message ??
              `You've used your 15 minutes for this month. Resets on ${
                payload.resets_on ?? usage.resetsOn
              }.`
          );
          return;
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as StreamEvent;
          throw new Error(payload.error ?? payload.message ?? "Live Translate failed.");
        }

        if (!contentType.includes("ndjson")) {
          // Legacy single-JSON response fallback (should not happen after deploy).
          const payload = (await response.json()) as StreamEvent;
          if (payload.error) throw new Error(payload.error);
          patchMessage(messageId, {
            originalText: payload.original_text?.trim() ?? "",
            translatedText: payload.translated_text?.trim() ?? "",
            audioBase64: payload.audio_base64 ?? null,
            stage: "done",
          });
          if (payload.audio_base64) {
            await playTranslatedAudio(payload.audio_base64);
          }
          return;
        }

        let sawDone = false;
        await readNdjsonStream(response, async (event) => {
          switch (event.stage) {
            case "hearing":
              patchMessage(messageId, { stage: "hearing" });
              break;
            case "transcript":
              patchMessage(messageId, {
                stage: "translating",
                originalText: event.original_text?.trim() ?? "",
              });
              break;
            case "translating":
              patchMessage(messageId, { stage: "translating" });
              break;
            case "translated":
              patchMessage(messageId, {
                // EN→PA still needs TTS; PA→EN is text-complete here.
                stage: language === "en" ? "speaking" : "done",
                translatedText: event.translated_text?.trim() ?? "",
              });
              break;
            case "speaking":
              patchMessage(messageId, { stage: "speaking" });
              break;
            case "skipped":
              setMessages((current) => current.filter((message) => message.id !== messageId));
              break;
            case "error":
              setMessages((current) => current.filter((message) => message.id !== messageId));
              throw new Error(event.error ?? "Live Translate failed.");
            case "done": {
              sawDone = true;
              const audioBase64 = event.audio_base64 ?? null;
              patchMessage(messageId, {
                stage: "done",
                originalText: event.original_text?.trim() ?? "",
                translatedText: event.translated_text?.trim() ?? "",
                audioBase64,
              });
              if (typeof event.seconds_remaining_this_month === "number") {
                setUsage((current) => ({
                  ...current,
                  secondsRemaining: event.seconds_remaining_this_month ?? 0,
                  secondsUsed:
                    event.seconds_used_this_month ??
                    current.capSeconds - (event.seconds_remaining_this_month ?? 0),
                }));
              }
              if (audioBase64) {
                await playTranslatedAudio(audioBase64);
              }
              break;
            }
            default:
              break;
          }
        });

        if (!sawDone) {
          // Stream ended without done/skipped — drop incomplete bubble.
          setMessages((current) => {
            const message = current.find((row) => row.id === messageId);
            if (!message || message.stage === "done") return current;
            if (message.originalText && message.translatedText) {
              return current.map((row) =>
                row.id === messageId ? { ...row, stage: "done" as const } : row
              );
            }
            return current.filter((row) => row.id !== messageId);
          });
        }
      } catch (caught) {
        setMessages((current) => current.filter((message) => message.id !== messageId));
        setError(caught instanceof Error ? caught.message : "Live Translate failed.");
      } finally {
        setProcessingTurn(false);
      }
    },
    [phase, patchMessage, playTranslatedAudio, usage.resetsOn]
  );

  const {
    micReady,
    holdingLanguage,
    processing,
    beginHold,
    endHold,
    cancelHold,
    playBase64Audio,
  } = useLiveTranslatePtt({
    enabled: phase === "active" && usage.secondsRemaining > 0,
    onClip: handleClip,
    onError: setError,
  });

  useEffect(() => {
    playBase64AudioRef.current = playBase64Audio;
  }, [playBase64Audio]);

  function handleStart() {
    if (usage.secondsRemaining <= 0) {
      setStatusMessage(`You've used your 15 minutes for this month. Resets on ${usage.resetsOn}.`);
      return;
    }
    setError(null);
    setStatusMessage(null);
    setMessages([]);
    setPhase("active");
  }

  function handleEnd() {
    setError(null);
    setStatusMessage(null);
    setMessages([]);
    setPhase("ready");
  }

  function bindHoldHandlers(language: LiveTranslateSpokenLanguage) {
    return {
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        void beginHold(language);
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        endHold();
      },
      onPointerCancel: () => {
        cancelHold();
      },
      onContextMenu: (event: MouseEvent) => {
        event.preventDefault();
      },
    };
  }

  if (phase === "ready") {
    return (
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-6">
          <div>
            <BackLink fallbackHref="/dashboard/home">← Back</BackLink>
            <h1 className="mt-4 text-2xl font-bold text-zinc-900">Live Translate</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Hold English or Punjabi while someone speaks that language. Nothing is saved — end
              the session and it&apos;s gone.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
            {formatSecondsRemaining(usage.secondsRemaining)}
          </div>

          {usage.secondsRemaining <= 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              You&apos;ve used your 15 minutes for this month. Your allowance resets on{" "}
              {usage.resetsOn}.
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

  const busy = processing || processingTurn;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-zinc-50 text-zinc-900">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Live Translate</p>
          <p className="text-xs text-zinc-500">
            {!micReady
              ? "Starting mic…"
              : holdingLanguage
                ? "Recording…"
                : "Hold a language to speak"}
            {busy ? " · Processing" : ""}
          </p>
        </div>
        <div className="text-right text-xs text-zinc-500">
          {formatSecondsRemaining(usage.secondsRemaining)}
        </div>
      </header>

      <div ref={feedRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-500">
            Hold <span className="font-semibold text-zinc-700">English</span> or{" "}
            <span className="font-semibold text-zinc-700">Punjabi</span> while that language is
            spoken. Release to translate.
          </p>
        ) : (
          messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              onReplay={
                message.audioBase64
                  ? () => {
                      void playTranslatedAudio(message.audioBase64!);
                    }
                  : undefined
              }
            />
          ))
        )}
      </div>

      {error ? (
        <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <footer className="border-t border-zinc-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy || (!!holdingLanguage && holdingLanguage !== "en")}
            className={`select-none rounded-2xl px-4 py-5 text-base font-semibold touch-none transition ${
              holdingLanguage === "en"
                ? "bg-violet-700 text-white ring-4 ring-violet-300"
                : "bg-violet-600 text-white active:bg-violet-700 disabled:opacity-50"
            }`}
            aria-pressed={holdingLanguage === "en"}
            {...bindHoldHandlers("en")}
          >
            English
          </button>
          <button
            type="button"
            disabled={busy || (!!holdingLanguage && holdingLanguage !== "pan")}
            className={`select-none rounded-2xl px-4 py-5 text-base font-semibold touch-none transition ${
              holdingLanguage === "pan"
                ? "bg-emerald-700 text-white ring-4 ring-emerald-300"
                : "bg-emerald-600 text-white active:bg-emerald-700 disabled:opacity-50"
            }`}
            aria-pressed={holdingLanguage === "pan"}
            {...bindHoldHandlers("pan")}
          >
            Punjabi
          </button>
        </div>
        <button
          type="button"
          onClick={handleEnd}
          className="mt-3 w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700"
        >
          End conversation
        </button>
      </footer>
    </div>
  );
}

function stageLabel(stage: BubbleStage, hasTranslation: boolean, hasAudio: boolean): string | null {
  switch (stage) {
    case "hearing":
      return "Hearing you…";
    case "translating":
      return "Translating…";
    case "speaking":
      return hasTranslation ? "Speaking…" : "Translating…";
    case "done":
      return hasAudio ? null : null;
    default:
      return null;
  }
}

function ChatBubble({
  message,
  onReplay,
}: {
  message: ChatMessage;
  onReplay?: () => void;
}) {
  const spokenLabel = message.spokenLanguage === "en" ? "English" : "Punjabi";
  const originalIsGurmukhi = containsGurmukhi(message.originalText);
  const status = stageLabel(
    message.stage,
    Boolean(message.translatedText),
    Boolean(message.audioBase64)
  );

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          {spokenLabel}
        </p>
        {onReplay ? (
          <button
            type="button"
            onClick={onReplay}
            className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-50"
          >
            Replay audio
          </button>
        ) : null}
      </div>

      {message.originalText ? (
        <p
          className={`mt-2 leading-snug text-zinc-900 ${
            originalIsGurmukhi ? "text-lg font-semibold" : "text-base font-medium"
          }`}
        >
          {message.originalText}
        </p>
      ) : (
        <p className="mt-2 text-sm italic text-zinc-500">{status ?? "Hearing you…"}</p>
      )}

      {message.translatedText ? (
        <p className="mt-2 border-t border-zinc-100 pt-2 text-sm leading-snug text-zinc-600">
          {message.translatedText}
        </p>
      ) : message.originalText && status ? (
        <p className="mt-2 border-t border-zinc-100 pt-2 text-sm italic text-zinc-500">{status}</p>
      ) : null}

      {message.stage === "speaking" && message.translatedText ? (
        <p className="mt-2 text-xs font-medium text-violet-600">Speaking…</p>
      ) : null}
    </article>
  );
}
