"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getHomeworkNearLessonWarning,
  submitHomeworkRecording,
} from "@/app/dashboard/learn/homework-actions";
import { HomeworkAudioPlayer } from "@/components/homework/homework-audio-player";
import { formatClock } from "@/lib/audio/media-duration";
import {
  recordingExtensionForBlob,
  useAudioRecorder,
} from "@/lib/audio/use-audio-recorder";
import { AudioScrubber } from "@/components/homework/homework-audio-player";
import { CatchupReturnButton } from "@/components/catchup/catchup-return-button";
import type { HomeworkSubmissionView } from "@/lib/tutoring/homework-submissions";
import { lessonContentRowButtonClass } from "@/components/lesson-card";
import { ui } from "@/lib/ui/styles";

type HomeworkSubmissionSectionProps = {
  lessonId: string;
  submission: HomeworkSubmissionView | null;
  variant?: "standalone" | "integrated" | "embedded";
  catchupReturn?: string | null;
  description?: string | null;
};

function homeworkSubtitle(submission: HomeworkSubmissionView | null): string {
  if (submission?.status === "reviewed") {
    return submission.approved
      ? "Reviewed and approved"
      : "Reviewed with feedback";
  }
  if (submission?.status === "pending_review") {
    return "Submitted, awaiting review";
  }
  return "Not submitted yet · Record a short voice note for your tutor after your session";
}

function NearLessonWarningBanner({
  message,
  tone = "late",
}: {
  message: string;
  tone?: "late" | "post_lesson";
}) {
  const classes =
    tone === "post_lesson"
      ? "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3"
      : "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3";
  const textClass = tone === "post_lesson" ? "text-sm text-rose-950" : "text-sm text-amber-950";
  return (
    <div className={classes}>
      <p className={textClass}>{message}</p>
    </div>
  );
}

function HomeworkRecorderBody({
  lessonId,
  localSubmission,
  variant,
  description,
}: {
  lessonId: string;
  localSubmission: HomeworkSubmissionView | null;
  variant: "standalone" | "integrated" | "embedded";
  description?: string | null;
}) {
  const router = useRouter();
  const recorder = useAudioRecorder();
  const [pending, startTransition] = useTransition();
  const submitLockRef = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [nearLessonWarning, setNearLessonWarning] = useState<string | null>(null);
  const [timingTone, setTimingTone] = useState<"late" | "post_lesson">("late");

  useEffect(() => {
    if (localSubmission) {
      setNearLessonWarning(null);
      return;
    }

    let cancelled = false;
    getHomeworkNearLessonWarning(lessonId).then((result) => {
      if (cancelled) return;
      setNearLessonWarning(result.nearLessonWarning ?? null);
      setTimingTone(result.timingState === "post_lesson" ? "post_lesson" : "late");
    });

    return () => {
      cancelled = true;
    };
  }, [lessonId, localSubmission]);

  // Keep the tab alive while a recording is being finalised or uploaded.
  useEffect(() => {
    if (!pending) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [pending]);

  function handleSubmit() {
    if (recorder.state === "finalising") {
      setActionError("Still saving your recording — try again in a moment.");
      return;
    }

    if (!recorder.blob) {
      setActionError("Please record your homework first.");
      return;
    }

    if (submitLockRef.current || pending) return;
    submitLockRef.current = true;

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
      try {
        const result = await submitHomeworkRecording(lessonId, formData);
        if (result.error) {
          setActionError(result.error);
          router.refresh();
          return;
        }

        setActionSuccess(result.success ?? "Homework submitted!");
        recorder.discardRecording();
        router.refresh();
      } finally {
        submitLockRef.current = false;
      }
    });
  }

  if (localSubmission?.status === "reviewed") {
    return (
      <div className={variant === "standalone" ? "mt-3" : "pt-2"}>
        <div
          className={`rounded-2xl px-4 py-3 ${
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
          {localSubmission.tutorComment ? (
            <p className="mt-2 text-sm text-zinc-700">{localSubmission.tutorComment}</p>
          ) : null}
        </div>
        {localSubmission.submissionType === "text" && localSubmission.textAnswers?.length ? (
          <ul className="mt-3 space-y-2">
            {localSubmission.textAnswers.map((answer) => (
              <li key={answer.question_number} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
                <span className="font-medium">{answer.question_number}.</span> {answer.answer_text}
              </li>
            ))}
          </ul>
        ) : null}
        {localSubmission.storagePath ? (
          <div className="mt-3">
            <HomeworkAudioPlayer
              storagePath={localSubmission.storagePath}
              durationSeconds={localSubmission.durationSeconds}
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (localSubmission?.status === "pending_review") {
    return (
      <div className={variant === "standalone" ? "mt-3" : "pt-2"}>
        <div className="rounded-2xl bg-violet-50 px-4 py-3">
          <p className="text-sm font-semibold text-violet-800">In review</p>
          <p className="mt-1 text-sm text-violet-700">
            Your tutor is reviewing your homework. You will get a notification when they have feedback.
          </p>
        </div>
        {localSubmission.submissionType === "text" && localSubmission.textAnswers?.length ? (
          <ul className="mt-3 space-y-2">
            {localSubmission.textAnswers.map((answer) => (
              <li key={answer.question_number} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
                <span className="font-medium">{answer.question_number}.</span> {answer.answer_text}
              </li>
            ))}
          </ul>
        ) : null}
        {localSubmission.storagePath ? (
          <div className="mt-3">
            <HomeworkAudioPlayer
              storagePath={localSubmission.storagePath}
              durationSeconds={localSubmission.durationSeconds}
            />
          </div>
        ) : null}
      </div>
    );
  }

  const intro =
    description ??
    (variant === "standalone"
      ? "Record a short voice note for your tutor to review after your session."
      : null);

  return (
    <div className={variant === "standalone" ? "mt-3" : "pt-2"}>
      {intro ? <p className="text-sm text-zinc-600">{intro}</p> : null}

      {nearLessonWarning ? (
        <div className={variant === "standalone" ? "mt-3" : "mb-3"}>
          <NearLessonWarningBanner message={nearLessonWarning} tone={timingTone} />
        </div>
      ) : null}

      {recorder.state === "idle" ? (
        <button
          type="button"
          onClick={() => void recorder.startRecording()}
          className={
            variant === "standalone" || nearLessonWarning || description
              ? `mt-3 ${ui.btnSecondary}`
              : ui.btnSecondary
          }
        >
          Record homework
        </button>
      ) : null}

      {recorder.state === "recording" || recorder.state === "finalising" ? (
        <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-red-800">
              {recorder.state === "recording" ? "Recording…" : "Saving your recording…"}
            </p>
            <p className="font-mono text-sm tabular-nums text-red-700">
              {formatClock(recorder.durationSeconds)}
            </p>
          </div>
          <button
            type="button"
            onClick={recorder.stopRecording}
            disabled={recorder.state === "finalising"}
            className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:bg-red-300"
          >
            {recorder.state === "recording" ? "Stop" : "Finishing…"}
          </button>
        </div>
      ) : null}

      {recorder.state === "recorded" && recorder.previewUrl ? (
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
          <p className="text-sm text-zinc-600">
            Listen back before you submit — you can only send this once.
          </p>
          <AudioScrubber
            src={recorder.previewUrl}
            durationSeconds={recorder.durationSeconds}
          />
          {recorder.notice ? (
            <p className="text-sm text-amber-800">{recorder.notice}</p>
          ) : null}
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
      ) : null}

      {(recorder.error || actionError) && (
        <p className="mt-3 text-sm text-red-600">{recorder.error ?? actionError}</p>
      )}
      {actionSuccess ? <p className="mt-3 text-sm text-green-700">{actionSuccess}</p> : null}
    </div>
  );
}

export function HomeworkSubmissionSection({
  lessonId,
  submission,
  variant = "standalone",
  catchupReturn = null,
  description = null,
}: HomeworkSubmissionSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [localSubmission, setLocalSubmission] = useState(submission);

  useEffect(() => {
    setLocalSubmission(submission);
  }, [submission]);

  if (variant === "integrated") {
    return (
      <>
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 py-3 last:border-b-0">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-900">Homework</p>
            <p className="mt-0.5 text-sm text-zinc-500">{homeworkSubtitle(localSubmission)}</p>
          </div>
          <button
            type="button"
            className={lessonContentRowButtonClass}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Close" : "Open"}
          </button>
        </div>
        {expanded ? (
          <div className="space-y-3 border-b border-zinc-100 pb-3">
            <HomeworkRecorderBody
              lessonId={lessonId}
              localSubmission={localSubmission}
              variant="integrated"
              description={description}
            />
            <CatchupReturnButton returnUrl={catchupReturn} />
          </div>
        ) : null}
      </>
    );
  }

  if (variant === "embedded") {
    return (
      <div className="space-y-3">
        <HomeworkRecorderBody
          lessonId={lessonId}
          localSubmission={localSubmission}
          variant="embedded"
          description={description}
        />
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Homework</p>
      <HomeworkRecorderBody
        lessonId={lessonId}
        localSubmission={localSubmission}
        variant="standalone"
        description={description}
      />
    </div>
  );
}
