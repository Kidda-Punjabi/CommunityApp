"use client";

import { useEffect, useRef } from "react";
import {
  formatRecordingDuration,
  useAudioRecorder,
} from "@/lib/audio/use-audio-recorder";
import { TUTOR_FEEDBACK_MAX_SECONDS } from "@/lib/tutoring/tutor-feedback-audio";
import { ui } from "@/lib/ui/styles";

export type PendingVoiceNote = {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
};

export function TutorVoiceNoteControl({
  disabled = false,
  onChange,
}: {
  disabled?: boolean;
  onChange: (note: PendingVoiceNote | null) => void;
}) {
  const recorder = useAudioRecorder({ maxDurationSeconds: TUTOR_FEEDBACK_MAX_SECONDS });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (recorder.state === "recorded" && recorder.blob) {
      onChangeRef.current({
        blob: recorder.blob,
        mimeType: recorder.blob.type || "audio/webm",
        durationSeconds: recorder.durationSeconds,
      });
      return;
    }
    if (recorder.state === "idle") onChangeRef.current(null);
  }, [recorder.blob, recorder.durationSeconds, recorder.state]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
      <p className="text-xs font-medium text-zinc-500">Voice note</p>
      {recorder.state === "idle" ? (
        <button
          type="button"
          className={`${ui.btnSecondary} mt-2`}
          disabled={disabled}
          onClick={() => void recorder.startRecording()}
        >
          Record voice note
        </button>
      ) : null}
      {recorder.state === "recording" ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-zinc-900" aria-live="polite">
            {formatRecordingDuration(recorder.durationSeconds)} / 2:00
          </p>
          <button
            type="button"
            className={ui.btnPrimary}
            disabled={disabled}
            onClick={recorder.stopRecording}
          >
            Stop
          </button>
        </div>
      ) : null}
      {recorder.state === "recorded" && recorder.previewUrl ? (
        <div className="mt-2 space-y-2">
          <audio controls src={recorder.previewUrl} className="w-full" preload="metadata" />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={ui.btnSecondary}
              disabled={disabled}
              onClick={() => void recorder.startRecording()}
            >
              Re-record
            </button>
            <button
              type="button"
              className={ui.btnSecondary}
              disabled={disabled}
              onClick={recorder.discardRecording}
            >
              Delete
            </button>
          </div>
        </div>
      ) : null}
      {recorder.error ? <p className="mt-2 text-sm text-red-600">{recorder.error}</p> : null}
    </div>
  );
}
