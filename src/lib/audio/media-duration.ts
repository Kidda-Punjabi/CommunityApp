/**
 * Duration helpers for MediaRecorder output.
 *
 * Chrome/Android write WebM without a Duration element, so `HTMLMediaElement.duration`
 * reads `Infinity`/`NaN` until the media is seeked near the end of the file.
 * Safari/iOS `audio/mp4` reports a finite duration immediately, so the repair is a no-op there.
 */

export function isUsableDuration(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function formatClock(totalSeconds: number | null | undefined): string {
  if (totalSeconds === 0) return "00:00";
  if (!isUsableDuration(totalSeconds)) return "00:00";
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Force Chrome to recompute duration for WebM files that report Infinity.
 * Seeks to a huge timestamp, then back to 0 once a finite duration appears.
 */
export function repairMediaDuration(media: HTMLMediaElement): Promise<number | null> {
  if (isUsableDuration(media.duration)) return Promise.resolve(media.duration);

  return new Promise((resolve) => {
    let settled = false;

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      media.removeEventListener("timeupdate", onTick);
      media.removeEventListener("durationchange", onTick);
      media.removeEventListener("seeked", onTick);
      clearTimeout(timeout);
      try {
        media.currentTime = 0;
      } catch {
        // Seeking back is best-effort; a fresh load starts at 0 anyway.
      }
      resolve(value);
    };

    const onTick = () => {
      if (isUsableDuration(media.duration)) finish(media.duration);
    };

    media.addEventListener("timeupdate", onTick);
    media.addEventListener("durationchange", onTick);
    media.addEventListener("seeked", onTick);
    const timeout = setTimeout(() => finish(null), 4000);

    try {
      media.currentTime = Number.MAX_SAFE_INTEGER;
    } catch {
      finish(null);
    }
  });
}
