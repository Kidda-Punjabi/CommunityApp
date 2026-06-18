import type { LessonCompletionStatus } from "@/lib/progress/lesson-completion";

type LessonCompletionIndicatorProps = {
  status: LessonCompletionStatus;
};

export function LessonCompletionRing({ status }: LessonCompletionIndicatorProps) {
  if (status.fullyComplete) {
    return (
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white"
        aria-label="Lesson complete"
        title="Lesson complete"
      >
        ✓
      </span>
    );
  }

  if (status.partsDone > 0) {
    return (
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-violet-500 text-[10px] font-bold text-violet-600"
        aria-label={`${status.partsDone} of ${status.partsTotal} parts complete`}
        title={`${status.partsDone} of ${status.partsTotal} parts complete`}
      >
        {status.partsDone}/{status.partsTotal}
      </span>
    );
  }

  return (
    <span
      className="h-7 w-7 shrink-0 rounded-full border-2 border-zinc-200"
      aria-label="Not started"
      title="Not started"
    />
  );
}

/** @deprecated Use LessonCompletionRing */
export function LessonCompletionIndicator({ status }: LessonCompletionIndicatorProps) {
  return <LessonCompletionRing status={status} />;
}

function RequirementItem({ label, complete }: { label: string; complete: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        complete ? "text-green-700" : "text-zinc-400"
      }`}
    >
      <span
        className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[10px] leading-none ${
          complete ? "bg-green-100 text-green-700" : "border border-zinc-300 text-zinc-300"
        }`}
        aria-hidden="true"
      >
        {complete ? "✓" : ""}
      </span>
      {label}
    </span>
  );
}

export function LessonRequirementStatus({ status }: LessonCompletionIndicatorProps) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      {status.pdfRequired && (
        <RequirementItem label="PDF" complete={status.pdfComplete} />
      )}
      {status.audioRequired && (
        <RequirementItem label="Audio" complete={status.audioComplete} />
      )}
      {status.flashcardsRequired && (
        <RequirementItem label="Flashcards" complete={status.flashcardsComplete} />
      )}
      {status.quizRequired && (
        <RequirementItem label="Quiz" complete={status.quizComplete} />
      )}
    </div>
  );
}

export function PracticeCompleteBadge() {
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700"
      aria-label="Complete"
      title="Complete"
    >
      ✓
    </span>
  );
}
