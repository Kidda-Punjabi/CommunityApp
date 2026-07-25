/** Three mastery stages for Everyday Punjabi topics. */

export const TOPIC_STAGES = [
  {
    id: 1,
    key: "vocab" as const,
    label: "Vocab",
    shortLabel: "Words",
    description: "Recognise and recall the words in this topic.",
    ringColor: "#EAB308", // yellow
    ringClass: "text-amber-500",
    fillClass: "bg-amber-400",
  },
  {
    id: 2,
    key: "sentences" as const,
    label: "Sentences",
    shortLabel: "Build",
    description: "Build phrases and sentences from this topic’s words.",
    ringColor: "#22C55E", // green
    ringClass: "text-emerald-500",
    fillClass: "bg-emerald-500",
  },
  {
    id: 3,
    key: "conversation" as const,
    label: "Conversation",
    shortLabel: "Talk",
    description: "Answer questions and ask people about this topic.",
    ringColor: "#7C3AED", // Kidda purple (violet-600)
    ringClass: "text-violet-600",
    fillClass: "bg-violet-600",
  },
] as const;

export type TopicStageId = (typeof TOPIC_STAGES)[number]["id"];
export type TopicStageKey = (typeof TOPIC_STAGES)[number]["key"];

/** Deep practice levels inside each stage (0–4 to attempt, 5 = stage complete). */
export const STAGE_DEPTH_MAX = 5;

/** Questions per depth level — gets harder as you go. */
export const STAGE_ACTIVITY_QUESTION_COUNTS = [4, 5, 6, 7, 8] as const;

/** Pass thresholds per depth level. */
export const STAGE_ACTIVITY_PASS_THRESHOLDS = [60, 70, 75, 80, 85] as const;

export type TopicStageFills = {
  vocab: number;
  sentences: number;
  conversation: number;
};

export function getStageMeta(stageId: TopicStageId) {
  return TOPIC_STAGES[stageId - 1];
}

/** Units complete across all stages (0–15). */
export function masteryUnits(stage: number, depth: number): number {
  const safeStage = Math.max(1, Math.min(3, stage));
  const safeDepth = Math.max(0, Math.min(STAGE_DEPTH_MAX, depth));
  return (safeStage - 1) * STAGE_DEPTH_MAX + safeDepth;
}

export function decodeMasteryUnits(units: number): {
  stage: TopicStageId;
  depth: number;
} {
  const clamped = Math.max(0, Math.min(STAGE_DEPTH_MAX * 3, Math.round(units)));
  if (clamped >= STAGE_DEPTH_MAX * 3) {
    return { stage: 3, depth: STAGE_DEPTH_MAX };
  }
  const stage = (Math.floor(clamped / STAGE_DEPTH_MAX) + 1) as TopicStageId;
  const depth = clamped % STAGE_DEPTH_MAX;
  return { stage, depth };
}

export function isFullyMastered(stage: number, depth: number): boolean {
  return stage >= 3 && depth >= STAGE_DEPTH_MAX;
}

/** Sequence unlock: finished at least the first vocab activity. */
export function isSequenceCompleteFromUnits(units: number): boolean {
  return units >= 1;
}

export function computeStageFills(
  stage: number,
  depth: number,
  progressPercent = 0
): TopicStageFills {
  const fills: TopicStageFills = {
    vocab: 0,
    sentences: 0,
    conversation: 0,
  };

  const partial = Math.max(0, Math.min(100, progressPercent)) / STAGE_DEPTH_MAX;

  if (stage > 1 || (stage === 1 && depth >= STAGE_DEPTH_MAX)) {
    fills.vocab = 100;
  } else if (stage === 1) {
    fills.vocab = Math.min(100, (depth / STAGE_DEPTH_MAX) * 100 + partial);
  }

  if (stage > 2 || (stage === 2 && depth >= STAGE_DEPTH_MAX)) {
    fills.sentences = 100;
  } else if (stage === 2) {
    fills.sentences = Math.min(100, (depth / STAGE_DEPTH_MAX) * 100 + partial);
  } else if (stage > 2) {
    fills.sentences = 100;
  }

  if (stage === 3) {
    fills.conversation =
      depth >= STAGE_DEPTH_MAX
        ? 100
        : Math.min(100, (depth / STAGE_DEPTH_MAX) * 100 + partial);
  }

  return fills;
}

export function advanceMasteryAfterPass(
  stage: TopicStageId,
  depth: number
): { stage: TopicStageId; depth: number; leveledUp: boolean; stageCleared: boolean } {
  if (isFullyMastered(stage, depth)) {
    return { stage: 3, depth: STAGE_DEPTH_MAX, leveledUp: false, stageCleared: false };
  }

  const nextDepth = depth + 1;
  if (nextDepth < STAGE_DEPTH_MAX) {
    return {
      stage,
      depth: nextDepth,
      leveledUp: true,
      stageCleared: false,
    };
  }

  // Cleared this stage.
  if (stage < 3) {
    return {
      stage: (stage + 1) as TopicStageId,
      depth: 0,
      leveledUp: true,
      stageCleared: true,
    };
  }

  return {
    stage: 3,
    depth: STAGE_DEPTH_MAX,
    leveledUp: true,
    stageCleared: true,
  };
}
