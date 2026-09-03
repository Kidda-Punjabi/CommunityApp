import { gameDeckPlayHref } from "@/lib/games/catalog";
import type { CatchupGameRef, CatchupSegment, SegmentActivityType } from "./types";
import { CATCHUP_RETURN_PARAM, buildCatchupReturnUrl } from "./return-url";
import { lessonHomeworkPath } from "@/lib/tutoring/homework-href";

type ActivityLinkContext = {
  lessonId: string;
  courseId: string;
  nextSegmentNumber: number;
  gameRef?: CatchupGameRef | null;
};

export function buildSegmentActivityHref(
  segment: CatchupSegment,
  context: ActivityLinkContext
): string | null {
  if (segment.activityType === "none" || !segment.activityInstructions) {
    if (segment.activityType === "none") return null;
  }

  const returnParam = `${CATCHUP_RETURN_PARAM}=${encodeURIComponent(
    buildCatchupReturnUrl(context.lessonId, context.nextSegmentNumber)
  )}`;

  switch (segment.activityType as SegmentActivityType) {
    case "quiz":
      if (!segment.activityRefId) return null;
      return `/dashboard/practice/quiz/${segment.activityRefId}?${returnParam}`;
    case "flashcard_set":
      if (!segment.activityRefId) return null;
      return `/dashboard/practice/flashcards/${context.lessonId}/${segment.activityRefId}/study?${returnParam}`;
    case "game": {
      const ref = context.gameRef;
      if (!ref) return null;
      if (ref.slug === "conversation-practice") {
        return `/dashboard/games/conversation-practice?${returnParam}`;
      }
      if (ref.slug === "voice-practice") {
        return `/dashboard/games/voice-practice?${returnParam}`;
      }
      if (ref.slug === "speaking-practice") {
        const segmentParam = ref.segmentId
          ? `&catchupSegmentId=${encodeURIComponent(ref.segmentId)}`
          : "";
        return `/dashboard/games/speaking-practice?${returnParam}${segmentParam}`;
      }
      if (ref.deckId) {
        return `${gameDeckPlayHref(ref.slug, ref.lessonId, ref.deckId)}?${returnParam}`;
      }
      return null;
    }
    case "homework":
      return lessonHomeworkPath(
        context.lessonId,
        buildCatchupReturnUrl(context.lessonId, context.nextSegmentNumber)
      );
    case "external_link":
      return segment.activityRefId ? String(segment.activityRefId) : null;
    default:
      return null;
  }
}
