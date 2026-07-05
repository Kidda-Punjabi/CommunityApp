"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CatchupBeatRow } from "@/components/catchup/catchup-beat-row";
import { CatchupSegmentActivity } from "@/components/catchup/catchup-segment-activity";
import { CatchupSegmentVisual } from "@/components/catchup/catchup-segment-visual";
import { buildSegmentActivityHref } from "@/lib/catchup/activity-links";
import { markCatchupSegmentComplete } from "@/lib/catchup/load-catchup";
import type {
  FillBlankQuestion,
  HomeworkTextQuestion,
  TranslateQuestion,
} from "@/lib/catchup/load-segment-questions";
import type { CatchupGameRef, CatchupLesson } from "@/lib/catchup/types";
import type { HomeworkSubmissionView } from "@/lib/tutoring/homework-submissions";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui/styles";

type CatchupPlayerProps = {
  lesson: CatchupLesson;
  initialSegmentNumber: number;
  courseId: string;
  gameRefs: Record<number, CatchupGameRef | null>;
  deckId: string | null;
  fillBlankBySegmentId: Record<string, FillBlankQuestion[]>;
  translateBySegmentId: Record<string, TranslateQuestion[]>;
  homeworkQuestions: HomeworkTextQuestion[];
  homeworkSubmission: HomeworkSubmissionView | null;
};

export function CatchupPlayer({
  lesson,
  initialSegmentNumber,
  courseId,
  gameRefs,
  deckId,
  fillBlankBySegmentId,
  translateBySegmentId,
  homeworkQuestions,
  homeworkSubmission,
}: CatchupPlayerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [segmentIndex, setSegmentIndex] = useState(() => {
    const idx = lesson.segments.findIndex((s) => s.segmentNumber === initialSegmentNumber);
    return idx >= 0 ? idx : 0;
  });
  const [activeBeatIndex, setActiveBeatIndex] = useState(0);
  const [beatsFinished, setBeatsFinished] = useState(false);

  const segment = lesson.segments[segmentIndex];
  const beats = segment?.beats ?? [];
  const hasActivity =
    segment &&
    (segment.activityType !== "none" || Boolean(segment.activityInstructions?.trim()));

  const hasInlineActivity =
    segment &&
    (segment.activityType === "fill_blank" ||
      segment.activityType === "translate" ||
      (segment.activityType === "homework" && segment.homeworkSubmissionType === "text"));

  const activityHref = useMemo(() => {
    if (!segment || hasInlineActivity) return null;
    return buildSegmentActivityHref(segment, {
      lessonId: lesson.lessonId,
      courseId,
      nextSegmentNumber: segment.segmentNumber + 1,
      gameRef: gameRefs[segment.segmentNumber] ?? null,
    });
  }, [segment, lesson.lessonId, courseId, gameRefs, hasInlineActivity]);

  const resetBeatPlayback = useCallback(() => {
    setActiveBeatIndex(0);
    setBeatsFinished(beats.length === 0);
  }, [beats.length]);

  useEffect(() => {
    resetBeatPlayback();
  }, [segment?.id, resetBeatPlayback]);

  useEffect(() => {
    const segmentNumber = lesson.segments[segmentIndex]?.segmentNumber;
    if (!segmentNumber) return;

    const params = new URLSearchParams(searchParams.toString());
    if (params.get("segment") === String(segmentNumber)) return;
    params.set("segment", String(segmentNumber));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [lesson.segments, pathname, router, searchParams, segmentIndex]);

  const advanceBeat = useCallback(() => {
    if (activeBeatIndex + 1 >= beats.length) {
      setBeatsFinished(true);
      return;
    }
    setActiveBeatIndex((index) => index + 1);
  }, [activeBeatIndex, beats.length]);

  async function completeSegment() {
    if (!segment) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await markCatchupSegmentComplete(supabase, user.id, segment.id);
  }

  async function goToNextSegment() {
    await completeSegment();
    if (segmentIndex + 1 < lesson.segments.length) {
      setSegmentIndex((index) => index + 1);
    }
  }

  function goToPreviousSegment() {
    if (segmentIndex > 0) {
      setSegmentIndex((index) => index - 1);
    }
  }

  function skipToContinue() {
    setBeatsFinished(true);
  }

  if (!segment) {
    return (
      <div className={ui.emptyState}>
        <p className="text-sm text-zinc-600">No catch-up segments are configured for this lesson yet.</p>
        <Link href="/dashboard/learn" className={`${ui.btnSecondary} mt-4`}>
          Back to Learn
        </Link>
      </div>
    );
  }

  const isLastSegment = segmentIndex >= lesson.segments.length - 1;

  return (
    <div className={ui.stackLoose}>
      <div>
        <Link href="/dashboard/learn" className="text-sm font-medium text-violet-600 hover:text-violet-500">
          ← Back to Learn
        </Link>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-violet-600">
          {lesson.courseName} · Lesson {lesson.lessonNumber}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">{lesson.lessonTitle}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Segment {segment.segmentNumber} of {lesson.segments.length}: {segment.title}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={segmentIndex === 0}
            onClick={goToPreviousSegment}
            className={ui.btnSecondary}
          >
            ← Previous segment
          </button>
          <button
            type="button"
            disabled={isLastSegment}
            onClick={() => void goToNextSegment()}
            className={ui.btnSecondary}
          >
            Next segment →
          </button>
        </div>
      </div>

      {segment.teachingVisual ? (
        <CatchupSegmentVisual visual={segment.teachingVisual} />
      ) : null}

      <div className={ui.stack}>
        {beats.map((beat, index) => (
          <CatchupBeatRow
            key={beat.id}
            beat={beat}
            isActive={!beatsFinished && index === activeBeatIndex}
            onPlay={() => {
              setBeatsFinished(false);
              setActiveBeatIndex(index);
            }}
            onEnded={advanceBeat}
          />
        ))}
      </div>

      {beats.length === 0 || beatsFinished ? (
        <div className={`${ui.cardBordered} space-y-4`}>
          {hasActivity && segment.activityInstructions ? (
            <>
              <h2 className="font-heading text-lg font-semibold text-zinc-900">Your turn</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                {segment.activityInstructions}
              </p>
              {hasInlineActivity ? (
                <CatchupSegmentActivity
                  segment={segment}
                  lessonId={lesson.lessonId}
                  fillBlankQuestions={fillBlankBySegmentId[segment.id] ?? []}
                  translateQuestions={translateBySegmentId[segment.id] ?? []}
                  homeworkQuestions={homeworkQuestions}
                  homeworkSubmission={homeworkSubmission}
                  onComplete={() => void goToNextSegment()}
                />
              ) : activityHref && segment.activityType !== "none" ? (
                <a href={activityHref} className={ui.btnPrimary}>
                  Do this activity now
                </a>
              ) : (
                <button type="button" onClick={() => void goToNextSegment()} className={ui.btnPrimary}>
                  {isLastSegment ? "Finish lesson" : "Continue to next segment"}
                </button>
              )}
            </>
          ) : (
            <button type="button" onClick={() => void goToNextSegment()} className={ui.btnPrimary}>
              {isLastSegment ? "Finish lesson" : "Continue to next segment"}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className="text-center text-xs text-zinc-500">
            Listening through the segment — tap Play on any beat to replay it.
          </p>
          <button type="button" onClick={skipToContinue} className={ui.btnSecondary}>
            Skip to continue
          </button>
        </div>
      )}
    </div>
  );
}
