import {
  getCourseRequiredTier,
  type CourseTierSource,
} from "@/lib/membership/access";
import { isPrivateCourseTier } from "@/lib/membership/tiers";
import type { PaidCourseTier } from "@/lib/membership/access";

export type LearnTourTileId =
  | "foundational"
  | "beginners"
  | "community"
  | "english";

export type CourseTourTarget = {
  courseId: string;
  courseName: string;
  tileId: LearnTourTileId;
};

export function learnTileTourSelector(tileId: LearnTourTileId): string {
  return `[data-tour="learn-tile-${tileId}"]`;
}

export function resolveLearnTourTileId(course: CourseTierSource): LearnTourTileId | null {
  if (isPrivateCourseTier(course.required_tier) || course.is_public === false) {
    return "english";
  }

  const tier = getCourseRequiredTier(course);
  if (tier === "foundational" || tier === "beginners" || tier === "community") {
    return tier;
  }
  return null;
}

/** Prefer public paid tracks; private English last. Stable for sequential queue. */
export function sortCourseTourTargets(targets: CourseTourTarget[]): CourseTourTarget[] {
  const order: Record<LearnTourTileId, number> = {
    foundational: 0,
    beginners: 1,
    community: 2,
    english: 3,
  };
  return [...targets].sort((a, b) => {
    const tierDiff = order[a.tileId] - order[b.tileId];
    if (tierDiff !== 0) return tierDiff;
    return a.courseName.localeCompare(b.courseName);
  });
}

export function dedupeTargetsByTile(targets: CourseTourTarget[]): CourseTourTarget[] {
  const seen = new Set<LearnTourTileId>();
  const out: CourseTourTarget[] = [];
  for (const target of targets) {
    if (seen.has(target.tileId)) continue;
    seen.add(target.tileId);
    out.push(target);
  }
  return out;
}

export function tierLabelForTile(tileId: LearnTourTileId): string {
  const labels: Record<LearnTourTileId, string> = {
    foundational: "Foundational",
    beginners: "Beginners",
    community: "Community",
    english: "Learn English",
  };
  return labels[tileId];
}

export type { PaidCourseTier };
