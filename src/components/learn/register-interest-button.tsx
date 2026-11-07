"use client";

import { registerCourseInterest } from "@/app/dashboard/learn/interest-actions";
import { InlineSpinner } from "@/components/ui/page-spinner";
import {
  COURSE_INTEREST_TIMELINES,
  type CourseInterestTimeline,
} from "@/lib/learn/course-interest-timeline";
import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";
import { useCallback, useEffect, useRef, useState, useTransition, type MouseEvent } from "react";
import { createPortal } from "react-dom";

type CourseLevel = "intermediate" | "advanced" | "kids_intermediate" | "kids_advanced";

type RegisterInterestButtonProps = {
  courseTitle: string;
  courseLevel: CourseLevel;
  className?: string;
  compact?: boolean;
  initiallyRegistered?: boolean;
};

/** Tell the team. keepalive lets it finish even if the page is closing. */
function notifyTeam(courseLevel: CourseLevel, timeline: CourseInterestTimeline | null) {
  try {
    void fetch("/api/course-interest/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseLevel, timeline }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Best effort: the interest itself is already saved.
  }
}

function StartTimelineSheet({
  courseTitle,
  onAnswer,
  onDone,
  answered,
}: {
  courseTitle: string;
  onAnswer: (timeline: CourseInterestTimeline | null) => void;
  onDone: () => void;
  answered: boolean;
}) {
  const [picked, setPicked] = useState<CourseInterestTimeline | null>(null);
  const stop = (event: MouseEvent) => event.stopPropagation();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (answered) onDone();
      else onAnswer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answered, onAnswer, onDone]);

  return (
    <div className="kidda-edge fixed inset-0 z-[60]" onClick={stop}>
      <button
        type="button"
        aria-label="Close"
        onClick={() => (answered ? onDone() : onAnswer(null))}
        className="absolute inset-0 h-full w-full bg-zinc-900/45"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="interest-sheet-title"
        className="absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col gap-4 rounded-t-[28px] bg-white px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-3"
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-zinc-300" aria-hidden />
        {answered ? (
          <>
            <div className="flex flex-col gap-1.5 pt-2 text-center">
              <h2 id="interest-sheet-title" className="font-heading text-xl font-semibold text-zinc-900">
                Thanks for letting us know
              </h2>
              <p className="text-sm text-zinc-600">One of the team will reach out to you.</p>
            </div>
            <button
              type="button"
              onClick={onDone}
              className="min-h-12 rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold text-white"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h2 id="interest-sheet-title" className="font-heading text-xl font-semibold text-zinc-900">
                When would you like to start?
              </h2>
              <p className="text-sm text-zinc-600">
                You&apos;re registered for {courseTitle}. This helps us get in touch at the right time.
              </p>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">When would you like to start?</legend>
              {COURSE_INTEREST_TIMELINES.map((option) => {
                const selected = picked === option.value;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-[15px]",
                      selected
                        ? "border-2 border-violet-600 bg-violet-50 font-semibold text-violet-900"
                        : "border-zinc-200 text-zinc-900"
                    )}
                  >
                    <input
                      type="radio"
                      name="interest-start"
                      value={option.value}
                      checked={selected}
                      onChange={() => setPicked(option.value)}
                      className="h-[18px] w-[18px] accent-violet-600"
                    />
                    {option.label}
                  </label>
                );
              })}
            </fieldset>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={!picked}
                onClick={() => onAnswer(picked)}
                className="min-h-12 rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                Send
              </button>
              <button
                type="button"
                onClick={() => onAnswer(null)}
                className="min-h-11 rounded-full px-6 py-3 text-sm font-medium text-zinc-600"
              >
                Skip for now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function RegisterInterestButton({
  courseTitle,
  courseLevel,
  className,
  compact = false,
  initiallyRegistered = false,
}: RegisterInterestButtonProps) {
  const [done, setDone] = useState(initiallyRegistered);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const [sheet, setSheet] = useState<"closed" | "ask" | "thanks">("closed");
  const notifiedRef = useRef(false);

  const answer = useCallback(
    (timeline: CourseInterestTimeline | null) => {
      if (!notifiedRef.current) {
        notifiedRef.current = true;
        notifyTeam(courseLevel, timeline);
      }
      setSheet("thanks");
    },
    [courseLevel]
  );

  // Leaving the page with the question still open still tells the team.
  useEffect(() => {
    if (sheet !== "ask") return;
    const onHide = () => {
      if (notifiedRef.current) return;
      notifiedRef.current = true;
      notifyTeam(courseLevel, null);
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      onHide();
    };
  }, [sheet, courseLevel]);

  return (
    <span className="shrink-0">
      <button
        type="button"
        disabled={done || pending}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (busy.current || done) return;
          busy.current = true;
          setError(null);
          startTransition(async () => {
            const result = await registerCourseInterest(courseLevel);
            if (!result.ok) {
              busy.current = false;
              setError(result.error);
              return;
            }
            setDone(true);
            setSheet("ask");
          });
        }}
        className={cn(
          pressableClass,
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold text-white shadow-sm disabled:opacity-80",
          compact ? "px-2 py-1 text-[10px] leading-none" : "px-3.5 py-1.5 text-xs",
          className
        )}
      >
        {pending ? <InlineSpinner /> : null}
        {done ? "Interest registered" : "Register interest"}
        <span className="sr-only"> for {courseTitle}</span>
      </button>
      {error ? <span className="mt-1 block text-[10px] font-medium text-red-600">{error}</span> : null}
      {sheet !== "closed" && typeof document !== "undefined"
        ? createPortal(
            <StartTimelineSheet
              courseTitle={courseTitle}
              answered={sheet === "thanks"}
              onAnswer={answer}
              onDone={() => setSheet("closed")}
            />,
            document.body
          )
        : null}
    </span>
  );
}
