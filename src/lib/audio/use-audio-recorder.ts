"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isUsableDuration, probeBlobDuration } from "@/lib/audio/media-duration";

/** `finalising` covers stop() → onstop, so a recording cannot be submitted half-written. */
export type AudioRecorderState = "idle" | "recording" | "finalising" | "recorded";

type UseAudioRecorderResult = {
  state: AudioRecorderState;
  durationSeconds: number;
  blob: Blob | null;
  previewUrl: string | null;
  /** Blocks submission — recording could not start or produced nothing. */
  error: string | null;
  /** Recording succeeded but may be short of what the student expected. */
  notice: string | null;
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
    try {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(type)) {
        return type;
      }
    } catch {
      // Older Safari throws instead of returning false — keep trying the next candidate.
    }
  }

  return "audio/webm";
}

export function recordingExtensionForBlob(blob: Blob): string {
  return extensionForMime(blob.type || getPreferredRecordingMimeType());
}

/**
 * Safari writes fragmented MP4 when given a timeslice, and the concatenated result
 * reports only the first fragment's length. Ask for one whole blob instead.
 */
function timesliceForMime(mimeType: string): number | undefined {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return undefined;
  return 1000;
}

function microphoneErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";

  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Microphone access is blocked. Allow the microphone for this site in your browser settings, then tap Record again.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No microphone was found. Connect one (or check your device settings) and try again.";
    case "NotReadableError":
    case "TrackStartError":
      return "Your microphone is being used by another app. Close it and tap Record again.";
    case "SecurityError":
      return "Recording needs a secure connection. Please reload the page over HTTPS.";
    case "AbortError":
      return "The microphone stopped unexpectedly. Please tap Record again.";
    default:
      return "Could not start recording. Check your microphone permission and try again.";
  }
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const [state, setState] = useState<AudioRecorderState>("idle");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const elapsedAtStopRef = useRef<number | null>(null);
  /** Set when the recording ended for a reason the student did not choose. */
  const interruptedRef = useRef<string | null>(null);

  const stopStream = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.onended = null;
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
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      try {
        recorder.stop();
      } catch {
        // Already tearing down.
      }
    }
    mediaRecorderRef.current = null;
    stopStream();
    chunksRef.current = [];
    startedAtRef.current = null;
    elapsedAtStopRef.current = null;
    interruptedRef.current = null;
    setDurationSeconds(0);
    setBlob(null);
    setPreviewUrl((current) => {
      revokePreview(current);
      return null;
    });
    setState("idle");
    setError(null);
    setNotice(null);
  }, [clearTimer, revokePreview, stopStream]);

  /** Shared by the Stop button and every interruption path. */
  const finishRecording = useCallback(
    (interruptionNotice?: string) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state !== "recording") return;

      if (interruptionNotice) interruptedRef.current = interruptionNotice;
      if (startedAtRef.current) {
        elapsedAtStopRef.current = Date.now() - startedAtRef.current;
      }

      clearTimer();
      setState("finalising");
      try {
        recorder.stop();
      } catch {
        // `onstop` will not fire — surface it rather than hanging on "Finishing…".
        setError("Recording could not be saved. Please try again.");
        setState("idle");
      }
    },
    [clearTimer]
  );

  const stopRecording = useCallback(() => {
    finishRecording();
  }, [finishRecording]);

  const startRecording = useCallback(async () => {
    discardRecording();

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(
        typeof window !== "undefined" && window.isSecureContext === false
          ? "Recording needs a secure connection. Please open the app over HTTPS."
          : "Recording is not supported in this browser. Try Chrome or Safari."
      );
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setError(
        "This browser cannot record audio. Please update it, or open the app in Chrome or Safari."
      );
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      stopStream();
      setError(microphoneErrorMessage(e));
      setState("idle");
      return;
    }

    streamRef.current = stream;

    const mimeType = getPreferredRecordingMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      try {
        // Let the browser pick its own container rather than failing outright.
        recorder = new MediaRecorder(stream);
      } catch (e) {
        stopStream();
        setError(microphoneErrorMessage(e));
        setState("idle");
        return;
      }
    }

    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onerror = () => {
      finishRecording(
        "Your microphone stopped part-way through. Play back what was captured before submitting."
      );
    };

    // The mic track ending mid-recording (device unplugged, grabbed by another app, OS
    // interruption) used to leave the timer running against a dead recorder.
    for (const track of stream.getAudioTracks()) {
      track.onended = () => {
        finishRecording(
          "Your microphone stopped part-way through. Play back what was captured before submitting."
        );
      };
    }

    recorder.onstop = () => {
      void (async () => {
        stopStream();
        const recorded = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType,
        });
        chunksRef.current = [];
        mediaRecorderRef.current = null;

        const wallClockSeconds = elapsedAtStopRef.current
          ? elapsedAtStopRef.current / 1000
          : startedAtRef.current
            ? (Date.now() - startedAtRef.current) / 1000
            : 0;
        startedAtRef.current = null;
        elapsedAtStopRef.current = null;

        if (recorded.size === 0) {
          setError("No audio was captured. Please check your microphone and try again.");
          setState("idle");
          setDurationSeconds(0);
          return;
        }

        // Trust the file over the wall clock: a recording cut short by the OS would
        // otherwise be stored with the longer elapsed time.
        const probed = await probeBlobDuration(recorded);
        const measured = isUsableDuration(probed) ? (probed as number) : wallClockSeconds;

        const url = URL.createObjectURL(recorded);
        setBlob(recorded);
        setPreviewUrl(url);
        setDurationSeconds(Math.max(1, Math.round(measured)));
        setNotice(interruptedRef.current);
        interruptedRef.current = null;
        setState("recorded");
      })();
    };

    const timeslice = timesliceForMime(recorder.mimeType || mimeType);
    try {
      if (timeslice == null) recorder.start();
      else recorder.start(timeslice);
    } catch (e) {
      stopStream();
      mediaRecorderRef.current = null;
      setError(microphoneErrorMessage(e));
      setState("idle");
      return;
    }

    startedAtRef.current = Date.now();
    setState("recording");
    setDurationSeconds(0);

    timerRef.current = setInterval(() => {
      if (startedAtRef.current) {
        setDurationSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 500);
  }, [discardRecording, finishRecording, stopStream]);

  // Mobile browsers suspend capture when the app is backgrounded. Close the recording
  // cleanly so the student keeps (and can hear) what was captured.
  useEffect(() => {
    if (state !== "recording") return;

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        finishRecording(
          "Recording stopped because you left the app. Play back what was captured before submitting."
        );
      }
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [state, finishRecording]);

  useEffect(() => {
    return () => {
      clearTimer();
      // Stop the recorder before the stream so `onstop` still fires and the blob closes.
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === "recording") {
        try {
          recorder.stop();
        } catch {
          // Nothing left to salvage on unmount.
        }
      }
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
    notice,
    startRecording,
    stopRecording,
    discardRecording,
  };
}
