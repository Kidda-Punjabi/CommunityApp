"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getHomeworkPlaybackUrl,
  submitHomeworkRecording,
} from "@/app/dashboard/learn/homework-actions";
import {
  formatRecordingDuration,
  recordingExtensionForBlob,
  useAudioRecorder,
} from "@/lib/audio/use-audio-recorder";
import type { HomeworkSubmissionView } from "@/lib/tutoring/homework-submissions";
import { ui } from "@/lib/ui/styles";

type HomeworkSubmissionSectionProps = {
  lessonId: string;
  submission: HomeworkSubmissionView | null;
};

function HomeworkAudioPlayback({ storagePath }: { storagePath: string }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getHomeworkPlaybackUrl(storagePath).then((result) => {
      if (cancelled) return;
      if (result.playbackUrl) {
        setAudioUrl(result.playbackUrl);
      } else {
        setError(result.error ?? "Could not load recording.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!audioUrl) {
    return <p className="text-sm text-zinc-500">Loading recording…</p>;
  }

  return <audio controls src={audioUrl} className="w-full" preload="metadata" />;
}

export function HomeworkSubmissionSection({
  lessonId,
  submission,
}: HomeworkSubmissionSectionProps) {
  const router = useRouter();
  const recorder = useAudioRecorder();
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [localSubmission, setLocalSubmission] = useState(submission);

  useEffect(() => {
    setLocalSubmission(submission);
  }, [submission]);

  function handleSubmit() {
    if (!recorder.blob) {
      setActionError("Please record your homework first.");
      return;
    }

    setActionError(null);
    setActionSuccess(null);

    const extension = recordingExtensionForBlob(recorder.blob);
    const formData = new FormData();
    formData.append(
      "audio",
      new File([recorder.blob], `homework.${extension}`, {
        type: recorder.blob.type || "audio/webm",
      })
    );
    formData.append("duration_seconds", String(recorder.durationSeconds));

    startTransition(async () => {
      const result = await submitHomeworkRecording(lessonId, formData);
      if (result.error) {
        setActionError(result.error);
        return;
      }

      setActionSuccess(result.success ?? "Homework submitted!");
      recorder.discardRecording();
      router.refresh();
    });
  }

  if (localSubmission?.status === "reviewed") {
    return (
      <div className="mt-4 border-t border-zinc-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Homework
        </p>
        <div
          className={`mt-3 rounded-2xl px-4 py-3 ${
            localSubmission.approved ? "bg-green-50" : "bg-amber-50"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              localSubmission.approved ? "text-green-800" : "text-amber-900"
            }`}
          >
            {localSubmission.approved
              ? "Great work — approved!"
              : "Keep going — your tutor left some tips"}
          </p>
          {localSubmission.tutorComment && (
            <p className="mt-2 text-sm text-zinc-700">{localSubmission.tutorComment}</p>
          )}
        </div>
        <div className="mt-3">
          <HomeworkAudioPlayback storagePath={localSubmission.storagePath} />
        </div>
      </div>
    );
  }

  if (localSubmission?.status === "pending_review") {
    return (
      <div className="mt-4 border-t border-zinc-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Homework
        </p>
        <div className="mt-3 rounded-2xl bg-violet-50 px-4 py-3">
          <p className="text-sm font-semibold text-violet-800">In review</p>
          <p className="mt-1 text-sm text-violet-700">
            Your tutor is listening. You will get a notification when they have feedback.
          </p>
        </div>
        {localSubmission.storagePath && (
          <div className="mt-3">
            <HomeworkAudioPlayback storagePath={localSubmission.storagePath} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Homework
      </p>
      <p className="mt-1 text-sm text-zinc-600">
        Record a short voice note for your tutor to review after your session.
      </p>

      {recorder.state === "idle" && (
        <button
          type="button"
          onClick={() => void recorder.startRecording()}
          className={`mt-3 ${ui.btnSecondary}`}
        >
          Record homework
        </button>
      )}

      {recorder.state === "recording" && (
        <div className="mt-3 space-y-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-red-800">Recording…</p>
            <p className="font-mono text-sm text-red-700">
              {formatRecordingDuration(recorder.durationSeconds)}
            </p>
          </div>
          <button
            type="button"
            onClick={recorder.stopRecording}
            className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
          >
            Stop
          </button>
        </div>
      )}

      {recorder.state === "recorded" && recorder.previewUrl && (
        <div className="mt-3 space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
          <audio controls src={recorder.previewUrl} className="w-full" preload="metadata" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={recorder.discardRecording}
              disabled={pending}
              className={ui.btnSecondary}
            >
              Re-record
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
              className={ui.btnPrimary}
            >
              {pending ? "Submitting…" : "Submit homework"}
            </button>
          </div>
        </div>
      )}

      {(recorder.error || actionError) && (
        <p className="mt-3 text-sm text-red-600">{recorder.error ?? actionError}</p>
      )}
      {actionSuccess && <p className="mt-3 text-sm text-green-700">{actionSuccess}</p>}
    </div>
  );
}
