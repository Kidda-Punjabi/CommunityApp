import {
  STAGE_ACTIVITY_PASS_THRESHOLDS,
  getStageMeta,
  type TopicStageId,
} from "@/lib/free-lessons/stages";

/** Shared copy for the next activity on the topic hub. */
export function activityMetaForLevel(
  stage: TopicStageId,
  depth: number
): { title: string; subtitle: string; passThreshold: number } | null {
  if (depth >= 5) return null;
  const activityDepth = Math.min(4, Math.max(0, depth)) as 0 | 1 | 2 | 3 | 4;
  const stageMeta = getStageMeta(stage);
  const labels = [
    "Warm-up",
    "Practice",
    "Challenge",
    "Stretch",
    "Stage check",
  ] as const;

  return {
    title: `${stageMeta.label} · ${labels[activityDepth]}`,
    subtitle: stageMeta.description,
    passThreshold: STAGE_ACTIVITY_PASS_THRESHOLDS[activityDepth],
  };
}
