import {
  SPEED_RAMP_INTERVAL_MS,
  SPEED_RAMP_MAX_BOOST,
  SPEED_RAMP_RATE,
} from "./config";

export function speedBoostFromActivePlayMs(activePlayMs: number): number {
  const steps = Math.floor(activePlayMs / SPEED_RAMP_INTERVAL_MS);
  return Math.min(steps * SPEED_RAMP_RATE, SPEED_RAMP_MAX_BOOST);
}

export function speedMultiplier(activePlayMs: number): number {
  return 1 + speedBoostFromActivePlayMs(activePlayMs);
}

/** Fall duration shrinks as speed increases (capped). */
export function fallDurationMs(activePlayMs: number, baseFallMs: number): number {
  return Math.round(baseFallMs / speedMultiplier(activePlayMs));
}
