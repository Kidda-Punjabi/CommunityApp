"use client";

import { getPreferredRecordingMimeType } from "@/lib/audio/use-audio-recorder";
import {
  messageForMicrophoneFailure,
  microphoneUnavailableFailure,
  type MicrophoneFailure,
} from "@/lib/audio/microphone-access-message";

export type PracticeRecordingOpen =
  | { ok: true; stream: MediaStream; recorder: MediaRecorder; mimeType: string }
  | { ok: false; failure: MicrophoneFailure };

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

/**
 * Open the mic and a MediaRecorder. Call this directly from the tap handler.
 * Do not await anything before it — iOS Safari denies getUserMedia outside the gesture.
 * Same constraints and mime choice as the homework recorder.
 */
export function startPracticeRecording(): Promise<PracticeRecordingOpen> {
  if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return Promise.resolve({ ok: false, failure: microphoneUnavailableFailure() });
  }
  if (typeof MediaRecorder === "undefined") {
    return Promise.resolve({ ok: false, failure: microphoneUnavailableFailure() });
  }

  const requested = navigator.mediaDevices.getUserMedia({ audio: true });

  return requested.then(
    (stream) => {
      const mimeType = getPreferredRecordingMimeType();
      try {
        const recorder = new MediaRecorder(stream, { mimeType });
        return { ok: true as const, stream, recorder, mimeType };
      } catch {
        stopStream(stream);
        return { ok: false as const, failure: microphoneUnavailableFailure() };
      }
    },
    (error: unknown) => ({ ok: false as const, failure: messageForMicrophoneFailure(error) })
  );
}
