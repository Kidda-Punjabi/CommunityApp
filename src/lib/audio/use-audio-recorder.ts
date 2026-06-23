"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AudioRecorderState = "idle" | "recording" | "recorded";

type UseAudioRecorderResult = {
  state: AudioRecorderState;
  durationSeconds: number;
  blob: Blob | null;
  previewUrl: string | null;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  discardRecording: () => void;
};

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export function getPreferredRecordingMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return "audio/webm";
}

export function recordingExtensionForBlob(blob: Blob): string {
  return extensionForMime(blob.type || getPreferredRecordingMimeType());
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const [state, setState] = useState<AudioRecorderState>("idle");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const stopStream = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const revokePreview = useCallback((url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  }, []);

  const discardRecording = useCallback(() => {
    clearTimer();
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    stopStream();
    chunksRef.current = [];
    startedAtRef.current = null;
    setDurationSeconds(0);
    setBlob(null);
    setPreviewUrl((current) => {
      revokePreview(current);
      return null;
    });
    setState("idle");
    setError(null);
  }, [clearTimer, revokePreview, stopStream]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.stop();
    clearTimer();
  }, [clearTimer]);

  const startRecording = useCallback(async () => {
    setError(null);
    discardRecording();

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getPreferredRecordingMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopStream();
        const recorded = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType,
        });
        chunksRef.current = [];
        mediaRecorderRef.current = null;

        if (recorded.size === 0) {
          setError("No audio was captured. Please try again.");
          setState("idle");
          setDurationSeconds(0);
          return;
        }

        const url = URL.createObjectURL(recorded);
        setBlob(recorded);
        setPreviewUrl(url);
        setState("recorded");
      };

      recorder.start(250);
      startedAtRef.current = Date.now();
      setState("recording");
      setDurationSeconds(0);

      timerRef.current = setInterval(() => {
        if (startedAtRef.current) {
          setDurationSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
        }
      }, 500);
    } catch {
      stopStream();
      setError("Microphone access is required to record homework.");
      setState("idle");
    }
  }, [discardRecording, stopStream]);

  useEffect(() => {
    return () => {
      clearTimer();
      stopStream();
      setPreviewUrl((current) => {
        revokePreview(current);
        return null;
      });
    };
  }, [clearTimer, revokePreview, stopStream]);

  return {
    state,
    durationSeconds,
    blob,
    previewUrl,
    error,
    startRecording,
    stopRecording,
    discardRecording,
  };
}

export function formatRecordingDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
