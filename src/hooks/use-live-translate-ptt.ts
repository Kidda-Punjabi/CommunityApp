"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LIVE_TRANSLATE_MIN_BLOB_BYTES,
  LIVE_TRANSLATE_MIN_HOLD_MS,
  type LiveTranslateSpokenLanguage,
} from "@/lib/live-translate/speech";

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export type LiveTranslatePttClip = {
  blob: Blob;
  durationSeconds: number;
  language: LiveTranslateSpokenLanguage;
};

type UseLiveTranslatePttOptions = {
  enabled: boolean;
  onClip: (clip: LiveTranslatePttClip) => void | Promise<void>;
  onError?: (message: string) => void;
};

/**
 * One getUserMedia stream for the whole session. Press-and-hold starts a
 * MediaRecorder on that stream; release stops and emits the clip.
 * Also unlocks a shared AudioContext on each press (Safari TTS autoplay).
 */
export function useLiveTranslatePtt({ enabled, onClip, onError }: UseLiveTranslatePttOptions) {
  const [micReady, setMicReady] = useState(false);
  const [holdingLanguage, setHoldingLanguage] = useState<LiveTranslateSpokenLanguage | null>(
    null
  );
  const [processing, setProcessing] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const unlockHtmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const holdStartedAtRef = useRef<number | null>(null);
  const holdLanguageRef = useRef<LiveTranslateSpokenLanguage | null>(null);
  const startingMicRef = useRef(false);
  const enabledRef = useRef(enabled);
  const onClipRef = useRef(onClip);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    onClipRef.current = onClip;
  }, [onClip]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const unlockAudio = useCallback(async () => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        if (!audioContextRef.current || audioContextRef.current.state === "closed") {
          audioContextRef.current = new Ctx();
        }
        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume();
        }

        // Silent buffer — ties Web Audio permission to this user gesture (Safari).
        const ctx = audioContextRef.current;
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      }

      // Unlock the same HTMLAudioElement used later for TTS (Safari gesture chain).
      if (!unlockHtmlAudioRef.current) {
        unlockHtmlAudioRef.current = new Audio();
        unlockHtmlAudioRef.current.preload = "auto";
      }
      const el = unlockHtmlAudioRef.current;
      el.src =
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
      el.volume = 0.001;
      await el.play().catch(() => undefined);
      el.pause();
      el.currentTime = 0;
      el.volume = 1;
    } catch {
      // Unlock is best-effort; tap-to-replay remains as fallback.
    }
  }, []);

  const playBase64Audio = useCallback(async (base64: string) => {
    await unlockAudio();
    const el = unlockHtmlAudioRef.current ?? new Audio();
    unlockHtmlAudioRef.current = el;
    el.pause();
    el.src = `data:audio/mpeg;base64,${base64}`;
    el.volume = 1;
    await new Promise<void>((resolve, reject) => {
      el.onended = () => resolve();
      el.onerror = () => reject(new Error("Could not play translated audio."));
      void el.play().then(() => undefined).catch(reject);
    });
  }, [unlockAudio]);

  const stopMic = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      try {
        recorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    holdStartedAtRef.current = null;
    holdLanguageRef.current = null;
    setHoldingLanguage(null);

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    startingMicRef.current = false;
    setMicReady(false);
  }, []);

  const ensureMic = useCallback(async () => {
    if (streamRef.current) {
      setMicReady(true);
      return streamRef.current;
    }
    if (startingMicRef.current) return null;
    startingMicRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!enabledRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return null;
      }
      streamRef.current = stream;
      setMicReady(true);
      return stream;
    } catch {
      onErrorRef.current?.("Microphone access is required for Live Translate.");
      setMicReady(false);
      return null;
    } finally {
      startingMicRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopMic();
      return;
    }

    void (async () => {
      await unlockAudio();
      await ensureMic();
    })();

    return () => {
      stopMic();
    };
  }, [enabled, ensureMic, stopMic, unlockAudio]);

  const beginHold = useCallback(
    async (language: LiveTranslateSpokenLanguage) => {
      if (!enabledRef.current || processing || holdLanguageRef.current) return;

      await unlockAudio();
      const stream = (await ensureMic()) ?? streamRef.current;
      if (!stream) return;

      const mimeType = pickRecorderMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      } catch {
        onErrorRef.current?.("Recording is not supported in this browser.");
        return;
      }

      chunksRef.current = [];
      holdStartedAtRef.current = Date.now();
      holdLanguageRef.current = language;
      setHoldingLanguage(language);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        holdLanguageRef.current = null;
        holdStartedAtRef.current = null;
        setHoldingLanguage(null);
        onErrorRef.current?.("Recording failed — try again.");
      };

      try {
        recorder.start();
      } catch {
        holdLanguageRef.current = null;
        holdStartedAtRef.current = null;
        setHoldingLanguage(null);
        onErrorRef.current?.("Could not start recording.");
      }
    },
    [ensureMic, processing, unlockAudio]
  );

  const endHold = useCallback(() => {
    const recorder = recorderRef.current;
    const language = holdLanguageRef.current;
    const startedAt = holdStartedAtRef.current;

    if (!recorder || !language || !startedAt) {
      holdLanguageRef.current = null;
      holdStartedAtRef.current = null;
      setHoldingLanguage(null);
      return;
    }

    if (recorder.state === "inactive") {
      holdLanguageRef.current = null;
      holdStartedAtRef.current = null;
      setHoldingLanguage(null);
      return;
    }

    recorder.onstop = () => {
      const holdMs = Date.now() - startedAt;
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || pickRecorderMimeType() || "audio/webm",
      });
      chunksRef.current = [];
      recorderRef.current = null;
      holdLanguageRef.current = null;
      holdStartedAtRef.current = null;
      setHoldingLanguage(null);

      if (holdMs < LIVE_TRANSLATE_MIN_HOLD_MS || blob.size < LIVE_TRANSLATE_MIN_BLOB_BYTES) {
        return;
      }

      setProcessing(true);
      void Promise.resolve(
        onClipRef.current({
          blob,
          durationSeconds: Math.max(1, Math.round(holdMs / 1000)),
          language,
        })
      )
        .catch((error) => {
          onErrorRef.current?.(
            error instanceof Error ? error.message : "Failed to process speech."
          );
        })
        .finally(() => {
          setProcessing(false);
        });
    };

    try {
      recorder.stop();
    } catch {
      holdLanguageRef.current = null;
      holdStartedAtRef.current = null;
      setHoldingLanguage(null);
    }
  }, []);

  const cancelHold = useCallback(() => {
    const recorder = recorderRef.current;
    holdLanguageRef.current = null;
    holdStartedAtRef.current = null;
    setHoldingLanguage(null);
    chunksRef.current = [];
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    }
    recorderRef.current = null;
  }, []);

  return {
    micReady,
    holdingLanguage,
    processing,
    beginHold,
    endHold,
    cancelHold,
    unlockAudio,
    playBase64Audio,
  };
}
