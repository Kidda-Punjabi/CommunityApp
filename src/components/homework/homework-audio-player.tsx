"use client";

import { useEffect, useRef, useState } from "react";
import { getHomeworkPlaybackUrl } from "@/app/dashboard/learn/homework-actions";
import {
  formatClock,
  isUsableDuration,
  repairMediaDuration,
} from "@/lib/audio/media-duration";
import { cn, pressableClass } from "@/lib/ui/styles";

/** Signed URLs last an hour; one silent re-fetch covers a card left open too long. */
const MAX_URL_REFRESHES = 1;

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" />
    </svg>
  );
}

type AudioScrubberProps = {
  src: string | null;
  /**
   * Known length of the recording. Authoritative for the scrubber bounds and timer:
   * WebM from MediaRecorder reports `Infinity` until the browser scans the whole file,
   * which is what made the native controls read `00:00 / 00:00`.
   */
  durationSeconds: number | null;
  loadingLabel?: string;
  /** Return true if a fresh source is being fetched, to suppress the error message. */
  onSourceError?: () => boolean;
};

function AudioScrubberInner({
  src,
  durationSeconds,
  loadingLabel,
  onSourceError,
}: Required<Pick<AudioScrubberProps, "loadingLabel">> & AudioScrubberProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const repairStartedRef = useRef(false);
  const repairingRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [liveDuration, setLiveDuration] = useState<number | null>(null);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submittedDuration = isUsableDuration(durationSeconds)
    ? (durationSeconds as number)
    : null;
  // Prefer the stored length, but never let the scrubber end before the audio does.
  const duration =
    submittedDuration != null && liveDuration != null
      ? Math.max(submittedDuration, liveDuration)
      : (submittedDuration ?? liveDuration);

  const displayTime = scrubTime ?? currentTime;

  async function handleLoadedMetadata() {
    const audio = audioRef.current;
    if (!audio) return;

    if (isUsableDuration(audio.duration)) {
      setLiveDuration(audio.duration);
      return;
    }

    // WebM `Infinity` duration — repair once, before playback starts.
    if (repairStartedRef.current) return;
    repairStartedRef.current = true;
    repairingRef.current = true;
    const repaired = await repairMediaDuration(audio);
    repairingRef.current = false;
    if (repaired != null) setLiveDuration(repaired);
    setCurrentTime(0);
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio || repairingRef.current || scrubTime != null) return;
    setCurrentTime(audio.currentTime);
  }

  function handleError() {
    if (onSourceError?.()) return;
    setError("Could not play this recording. Please reload the page.");
  }

  function seekTo(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = seconds;
      setCurrentTime(seconds);
    } catch {
      // Media not seekable yet — leave the playhead where it is.
    }
  }

  function commitScrub() {
    if (scrubTime == null) return;
    seekTo(scrubTime);
    setScrubTime(null);
  }

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.paused) {
      audio.pause();
      return;
    }

    try {
      await audio.play();
    } catch {
      setError("Playback was blocked by the browser. Tap play again.");
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-3">
      {/*
        Rendered unconditionally so a parent re-render cannot tear down and recreate the
        element mid-playback — that was one way playback stopped partway through.
      */}
      <audio
        ref={audioRef}
        src={src ?? undefined}
        // Buffer the whole clip up front: short notes stall on partial-content requests.
        preload="auto"
        onLoadedMetadata={() => void handleLoadedMetadata()}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(duration ?? 0);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={src ? handleError : undefined}
        className="hidden"
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void togglePlay()}
          disabled={!src}
          aria-label={playing ? "Pause recording" : "Play recording"}
          className={cn(
            pressableClass,
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white transition-colors hover:bg-violet-500 disabled:bg-zinc-300"
          )}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={duration ?? 1}
            step={0.1}
            value={Math.min(displayTime, duration ?? 1)}
            disabled={!src || duration == null}
            aria-label="Playback position"
            onChange={(event) => setScrubTime(Number(event.target.value))}
            onPointerUp={commitScrub}
            onKeyUp={commitScrub}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-violet-600 disabled:cursor-default"
          />
          <p className="mt-1.5 font-mono text-xs tabular-nums text-zinc-500">
            {formatClock(displayTime)} / {formatClock(duration)}
          </p>
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {!src && !error ? <p className="mt-2 text-xs text-zinc-400">{loadingLabel}</p> : null}
    </div>
  );
}

/** Keyed on `src` so a new recording starts from a clean playback state. */
export function AudioScrubber({
  src,
  durationSeconds,
  loadingLabel = "Loading recording…",
  onSourceError,
}: AudioScrubberProps) {
  return (
    <AudioScrubberInner
      key={src ?? "pending"}
      src={src}
      durationSeconds={durationSeconds}
      loadingLabel={loadingLabel}
      onSourceError={onSourceError}
    />
  );
}

type HomeworkAudioPlayerProps = {
  storagePath: string;
  durationSeconds: number | null;
};

type PlaybackResult =
  | { path: string; url: string; message?: undefined }
  | { path: string; url?: undefined; message: string };

async function resolvePlaybackResult(storagePath: string): Promise<PlaybackResult> {
  const response = await getHomeworkPlaybackUrl(storagePath);
  return response.playbackUrl
    ? { path: storagePath, url: response.playbackUrl }
    : { path: storagePath, message: response.error ?? "Could not load recording." };
}

/** Plays a stored submission, minting a fresh signed URL each time the card is viewed. */
export function HomeworkAudioPlayer({
  storagePath,
  durationSeconds,
}: HomeworkAudioPlayerProps) {
  const urlRefreshCountRef = useRef(0);
  // Tagged with the path it belongs to, so a changed path never shows stale audio.
  const [result, setResult] = useState<PlaybackResult | null>(null);

  // The URL minted at submit time expired long before review, so always re-request.
  useEffect(() => {
    urlRefreshCountRef.current = 0;
    let cancelled = false;

    resolvePlaybackResult(storagePath).then((next) => {
      if (!cancelled) setResult(next);
    });

    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  const current = result?.path === storagePath ? result : null;

  function handleSourceError(): boolean {
    if (urlRefreshCountRef.current >= MAX_URL_REFRESHES) return false;
    urlRefreshCountRef.current += 1;
    void resolvePlaybackResult(storagePath).then(setResult);
    return true;
  }

  if (current?.message) return <p className="text-sm text-red-600">{current.message}</p>;

  return (
    <AudioScrubber
      src={current?.url ?? null}
      durationSeconds={durationSeconds}
      onSourceError={handleSourceError}
    />
  );
}
