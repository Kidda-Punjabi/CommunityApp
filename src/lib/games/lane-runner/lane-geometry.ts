import type { LaneIndex } from "./types";

/** Lane center x (% of road width) at the contact line (progress = 1). */
export const LANE_CONTACT_X: readonly [number, number, number] = [16.67, 50, 83.33];

/** Lane center x (% of road width) at the horizon (progress = 0) — narrow spread. */
export const LANE_HORIZON_X: readonly [number, number, number] = [43, 50, 57];

/** Vertical position (% of road panel height) at the horizon. */
export const HORIZON_TOP_PERCENT = 6;

/** Vertical position (% of road panel height) at the contact line. */
export const CONTACT_TOP_PERCENT = 78;

export function clampProgress(progress: number): number {
  return Math.max(0, Math.min(1, progress));
}

/** Horizontal lane center at a given fall progress (0 = horizon, 1 = contact). */
export function laneX(lane: LaneIndex, progress: number): number {
  const p = clampProgress(progress);
  const atHorizon = LANE_HORIZON_X[lane];
  const atContact = LANE_CONTACT_X[lane];
  return atHorizon + (atContact - atHorizon) * p;
}

/** Vertical position (% of road height) at a given fall progress. */
export function laneY(progress: number): number {
  const p = clampProgress(progress);
  return HORIZON_TOP_PERCENT + (CONTACT_TOP_PERCENT - HORIZON_TOP_PERCENT) * p;
}

/** Boundary between two adjacent lanes (0 = between lanes 0|1, 1 = between lanes 1|2). */
export function laneBoundaryX(boundary: 0 | 1, progress: number): number {
  const leftLane = boundary as LaneIndex;
  const rightLane = (boundary + 1) as LaneIndex;
  return (laneX(leftLane, progress) + laneX(rightLane, progress)) / 2;
}

export function scaleAtProgress(
  progress: number,
  startScale: number,
  endScale: number
): number {
  const p = clampProgress(progress);
  return startScale + (endScale - startScale) * p;
}

/** SVG/viewBox endpoints for a lane boundary divider (0–100 coordinate space). */
export function laneBoundarySegment(boundary: 0 | 1): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
} {
  return {
    x1: laneBoundaryX(boundary, 0),
    y1: laneY(0),
    x2: laneBoundaryX(boundary, 1),
    y2: laneY(1),
  };
}
