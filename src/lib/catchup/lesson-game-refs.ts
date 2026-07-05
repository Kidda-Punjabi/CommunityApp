import type { CatchupGameRef } from "@/lib/catchup/types";

const WEEK1_DECK_ID = "fbd0d21f-6ddc-4a8f-8480-5ff97e426d61";
const WEEK2_MASTER_DECK_ID = "b5f8673e-5cc3-4139-8379-36b035837676";

export function catchupGameRefsForLesson(
  lessonNumber: number,
  lessonId: string,
  segmentIdByNumber: Record<number, string | undefined>
): Record<number, CatchupGameRef | null> {
  if (lessonNumber === 1) {
    return {
      6: { slug: "memory-grid", lessonId, deckId: WEEK1_DECK_ID },
      8: { slug: "conversation-practice", lessonId },
    };
  }

  if (lessonNumber === 2) {
    return {
      11: {
        slug: "speaking-practice",
        lessonId,
        segmentId: segmentIdByNumber[11],
      },
    };
  }

  return {};
}

export function catchupDeckIdForLesson(lessonNumber: number): string | null {
  if (lessonNumber === 1) return WEEK1_DECK_ID;
  if (lessonNumber === 2) return WEEK2_MASTER_DECK_ID;
  return null;
}
