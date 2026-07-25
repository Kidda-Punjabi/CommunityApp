import type { TopicMasteryRow } from "@/lib/free-lessons/mastery";

/** Passing Warm-up (level ≥ 1) counts as completing a topic for sequence unlock. */
export const TOPIC_SEQUENCE_COMPLETE_LEVEL = 1;

export type TopicLockReason = "none" | "sequence" | "premium";

export type TopicUnlockState = {
  sequenceUnlocked: boolean;
  needsPremium: boolean;
  /** Can open and practise this topic. */
  accessible: boolean;
  lockReason: TopicLockReason;
};

/**
 * Topic N unlocks only after topic N-1 is sequence-complete.
 * Premium removes the paywall for paid topics, never the sequence gate.
 */
export function resolveTopicUnlockState(input: {
  lessonNumber: number;
  isFree: boolean;
  hasPremium: boolean;
  previousMasteryLevel: number | null;
}): TopicUnlockState {
  const sequenceUnlocked =
    input.lessonNumber <= 1 ||
    (input.previousMasteryLevel ?? 0) >= TOPIC_SEQUENCE_COMPLETE_LEVEL;

  const needsPremium = !input.isFree && !input.hasPremium;

  if (!sequenceUnlocked) {
    return {
      sequenceUnlocked: false,
      needsPremium,
      accessible: false,
      lockReason: "sequence",
    };
  }

  if (needsPremium) {
    return {
      sequenceUnlocked: true,
      needsPremium: true,
      accessible: false,
      lockReason: "premium",
    };
  }

  return {
    sequenceUnlocked: true,
    needsPremium: false,
    accessible: true,
    lockReason: "none",
  };
}

export function isTopicSequenceComplete(
  mastery: TopicMasteryRow | undefined
): boolean {
  return (mastery?.mastery_level ?? 0) >= TOPIC_SEQUENCE_COMPLETE_LEVEL;
}
