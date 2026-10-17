const ONE_MINUTE_MS = 60 * 1000;

/** True when two timestamps are different instants by at least one minute. */
export function classStartMoved(previous: string, next: string): boolean {
  const oldMs = Date.parse(previous);
  const newMs = Date.parse(next);
  if (!Number.isFinite(oldMs) || !Number.isFinite(newMs)) return false;
  return Math.abs(newMs - oldMs) >= ONE_MINUTE_MS;
}
