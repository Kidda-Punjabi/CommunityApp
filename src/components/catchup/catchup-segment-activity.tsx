"use client";

import { CatchupFillBlankActivity } from "@/components/catchup/catchup-fill-blank-activity";
import { CatchupTranslateActivity } from "@/components/catchup/catchup-translate-activity";
import { CatchupWrittenHomework } from "@/components/catchup/catchup-written-homework";
import type {
  FillBlankQuestion,
  HomeworkTextQuestion,
  TranslateQuestion,
} from "@/lib/catchup/load-segment-questions";
import type { CatchupSegment, HomeworkSubmissionType } from "@/lib/catchup/types";
import type { HomeworkSubmissionView } from "@/lib/tutoring/homework-submissions";

type CatchupSegmentActivityProps = {
  segment: CatchupSegment;
  lessonId: string;
  fillBlankQuestions: FillBlankQuestion[];
  translateQuestions: TranslateQuestion[];
  homeworkQuestions: HomeworkTextQuestion[];
  homeworkSubmission: HomeworkSubmissionView | null;
  onComplete: () => void;
};

export function CatchupSegmentActivity({
  segment,
  lessonId,
  fillBlankQuestions,
  translateQuestions,
  homeworkQuestions,
  homeworkSubmission,
  onComplete,
}: CatchupSegmentActivityProps) {
  if (segment.activityType === "fill_blank" && fillBlankQuestions.length > 0) {
    return (
      <CatchupFillBlankActivity
        segmentId={segment.id}
        questions={fillBlankQuestions}
        onComplete={onComplete}
      />
    );
  }

  if (segment.activityType === "translate" && translateQuestions.length > 0) {
    return (
      <CatchupTranslateActivity
        segmentId={segment.id}
        questions={translateQuestions}
        onComplete={onComplete}
      />
    );
  }

  if (
    segment.activityType === "homework" &&
    segment.homeworkSubmissionType === ("text" as HomeworkSubmissionType) &&
    homeworkQuestions.length > 0
  ) {
    return (
      <CatchupWrittenHomework
        lessonId={lessonId}
        questions={homeworkQuestions}
        existingSubmission={homeworkSubmission}
        onComplete={onComplete}
      />
    );
  }

  return null;
}
