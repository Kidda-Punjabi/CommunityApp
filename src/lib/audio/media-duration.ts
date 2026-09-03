/**
 * Duration helpers for MediaRecorder output.
 *
 * Chrome/Android write WebM without a Duration element, so `HTMLMediaElement.duration`
 * reads `Infinity` until the media is seeked to the end. Safari/iOS `audio/mp4` reports a
 * finite duration immediately, so the repair below is a no-op there.
 */

/** Far past any real recording — forces the browser to scan to the last frame. */
const END_SEEK_TARGET = 1e101;

export function isUsableDuration(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function formatClock(totalSeconds: number | null | undefined): string {
  if (!isUsableDuration(totalSeconds) && totalSeconds !== 0) return "--:--";
  const safe = Math.max(0, Math.floor(totalSeconds ?? 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Resolve a real duration for a media element whose `duration` is `Infinity`/`NaN`.
 * Seeks to the end so the browser scans the file, then restores the playhead.
 * Resolves with `null` when the browser refuses to seek.
 */
export function repairMediaDuration(media: HTMLMediaElement): Promise<number | null> {
  if (isUsableDuration(media.duration)) return Promise.resolve(media.duration);

  return new Promise((resolve) => {
    let settled = false;

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      media.removeEventListener("timeupdate", onTimeUpdate);
      media.removeEventListener("durationchange", onDurationChange);
      clearTimeout(timeout);
      try {
        media.currentTime = 0;
      } catch {
        // Seeking back is best-effort; a fresh load starts at 0 anyway.
      }
      resolve(value);
    };

    const settleIfReady = () => {
      if (isUsableDuration(media.duration)) finish(media.duration);
    };

    const onTimeUpdate = () => settleIfReady();
    const onDurationChange = () => settleIfReady();

    media.addEventListener("timeupdate", onTimeUpdate);
    media.addEventListener("durationchange", onDurationChange);
    const timeout = setTimeout(() => finish(null), 4000);

    try {
      media.currentTime = END_SEEK_TARGET;
    } catch {
      finish(null);
    }
  });
}

/**
 * Decode a recorded blob far enough to read its true length, so a recording that was
 * cut short by the OS is not reported with its (longer) wall-clock timer value.
 */
export async function probeBlobDuration(blob: Blob): Promise<number | null> {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;

  const url = URL.createObjectURL(blob);
  const audio = new Audio();
  audio.preload = "metadata";
  audio.src = url;

  try {
    const metadata = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 4000);
      audio.addEventListener(
        "loadedmetadata",
        () => {
          clearTimeout(timeout);
          resolve(true);
        },
        { once: true }
      );
      audio.addEventListener(
        "error",
        () => {
          clearTimeout(timeout);
          resolve(false);
        },
        { once: true }
      );
    });

    if (!metadata) return null;
    if (isUsableDuration(audio.duration)) return audio.duration;
    return await repairMediaDuration(audio);
  } finally {
    audio.removeAttribute("src");
    audio.load();
    URL.revokeObjectURL(url);
  }
}
