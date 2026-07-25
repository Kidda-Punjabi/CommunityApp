import {
  STAGE_ACTIVITY_PASS_THRESHOLDS,
  STAGE_ACTIVITY_QUESTION_COUNTS,
  getStageMeta,
  type TopicStageId,
} from "@/lib/free-lessons/stages";

/** Embedded game kinds used inside Everyday Punjabi mastery practice. */
export type TopicGameKind =
  | "match"
  | "speed_quiz"
  | "tiles"
  | "speak";

export type TopicGameActivitySpec = {
  stage: TopicStageId;
  depth: 0 | 1 | 2 | 3 | 4;
  kind: TopicGameKind;
  title: string;
  subtitle: string;
  itemCount: number;
  passThreshold: number;
  /** Speed quiz: show Punjabi, pick English. */
  reverseQuiz?: boolean;
};

const DEPTH_LABELS = [
  "Warm-up",
  "Practice",
  "Challenge",
  "Stretch",
  "Stage check",
] as const;

/**
 * Map stage + depth → a real game activity (not MCQ-with-hints).
 *
 * Vocab → Match / Speed quiz (from Games)
 * Sentences → Tile builder
 * Conversation → Speaking (+ tiles for one stretch level)
 */
export function resolveTopicGameActivity(
  stage: TopicStageId,
  depth: number
): TopicGameActivitySpec | null {
  if (depth >= 5) return null;
  const activityDepth = Math.min(4, Math.max(0, depth)) as 0 | 1 | 2 | 3 | 4;
  const stageMeta = getStageMeta(stage);
  const itemCount = STAGE_ACTIVITY_QUESTION_COUNTS[activityDepth];
  const passThreshold = STAGE_ACTIVITY_PASS_THRESHOLDS[activityDepth];
  const depthLabel = DEPTH_LABELS[activityDepth];

  if (stage === 1) {
    const vocabKinds: TopicGameKind[] = [
      "match",
      "speed_quiz",
      "match",
      "speed_quiz",
      "match",
    ];
    const kind = vocabKinds[activityDepth];
    const reverseQuiz = activityDepth >= 2 && kind === "speed_quiz";
    return {
      stage,
      depth: activityDepth,
      kind,
      title: `${stageMeta.label} · ${depthLabel}`,
      subtitle:
        kind === "match"
          ? "Tap matching Punjabi and English tiles — like Match."
          : reverseQuiz
            ? "See the Punjabi — pick the English meaning fast."
            : "See the English — pick the Punjabi fast.",
      itemCount,
      passThreshold,
      reverseQuiz,
    };
  }

  if (stage === 2) {
    // Depth 3 adds a little speaking after tiles in the UI; kind stays tiles for scoring.
    return {
      stage,
      depth: activityDepth,
      kind: "tiles",
      title: `${stageMeta.label} · ${depthLabel}`,
      subtitle:
        activityDepth >= 3
          ? "Build the phrase with tiles, then say it out loud."
          : "Build each phrase by tapping the Punjabi tiles in order.",
      itemCount,
      passThreshold,
    };
  }

  // Stage 3 — conversation / speaking focused
  const talkKinds: TopicGameKind[] = [
    "speak",
    "speak",
    "tiles", // conversational phrase building
    "speak",
    "speak",
  ];
  const kind = talkKinds[activityDepth];
  return {
    stage,
    depth: activityDepth,
    kind,
    title: `${stageMeta.label} · ${depthLabel}`,
    subtitle:
      kind === "speak"
        ? "Say the Punjabi out loud — we’ll check your speaking."
        : "Build the reply you’d say in conversation.",
    itemCount,
    passThreshold,
  };
}

export function activityMetaForLevel(
  stage: TopicStageId,
  depth: number
): { title: string; subtitle: string; passThreshold: number } | null {
  const spec = resolveTopicGameActivity(stage, depth);
  if (!spec) return null;
  return {
    title: spec.title,
    subtitle: spec.subtitle,
    passThreshold: spec.passThreshold,
  };
}
