"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getHomeworkPlaybackUrl } from "@/app/dashboard/learn/homework-actions";
import {
  formatClock,
  isUsableDuration,
  repairMediaDuration,
} from "@/lib/audio/media-duration";
import { cn, pressableClass } from "@/lib/ui/styles";

type PlaybackUrlLoader = (storagePath: string) => Promise<{
  playbackUrl?: string;
  error?: string;
}>;

type HomeworkAudioPlayerProps = {
  storagePath: string;
  durationSeconds: number | null;
  loadPlaybackUrl?: PlaybackUrlLoader;
};

/**
 * Homework voice-note player.
 *
 * MediaRecorder WebM files report `audio.duration = Infinity` until Chrome is
 * forced to scan the end of the file. The progress bar uses `duration_seconds`
 * from `homework_submissions` as the source of truth, and a one-time seek
 * repair makes the element itself play through to the real end.
 */
export function HomeworkAudioPlayer({
  storagePath,
  durationSeconds,
  loadPlaybackUrl = getHomeworkPlaybackUrl,
}: HomeworkAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const repairingRef = useRef(false);
  const repairPromiseRef = useRef<Promise<number | null> | null>(null);

  const [src, setSrc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [liveDuration, setLiveDuration] = useState<number | null>(null);
  const [scrubTime, setScrubTime] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setLoadError(null);
    setPlayError(null);
    setPlaying(false);
    setCurrentTime(0);
    setLiveDuration(null);
    setScrubTime(null);
    repairPromiseRef.current = null;

    loadPlaybackUrl(storagePath).then((result) => {
      if (cancelled) return;
      if (result.playbackUrl) {
        setSrc(result.playbackUrl);
      } else {
        setLoadError(result.error ?? "Could not load audio.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadPlaybackUrl, storagePath]);

  const submittedDuration = isUsableDuration(durationSeconds)
    ? durationSeconds
    : null;
  const duration =
    submittedDuration != null && liveDuration != null
      ? Math.max(submittedDuration, liveDuration)
      : (submittedDuration ?? liveDuration);
  const displayTime = scrubTime ?? currentTime;

  async function ensureFiniteDuration(audio: HTMLAudioElement) {
    if (isUsableDuration(audio.duration)) {
      setLiveDuration(audio.duration);
      return audio.duration;
    }
    if (!repairPromiseRef.current) {
      repairingRef.current = true;
      repairPromiseRef.current = repairMediaDuration(audio).finally(() => {
        repairingRef.current = false;
      });
    }
    const repaired = await repairPromiseRef.current;
    if (repaired != null) setLiveDuration(repaired);
    setCurrentTime(0);
    return repaired;
  }

  async function handleLoadedMetadata() {
    const audio = audioRef.current;
    if (!audio) return;
    await ensureFiniteDuration(audio);
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio || repairingRef.current || scrubTime != null) return;
    setCurrentTime(audio.currentTime);
  }

  function seekTo(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = seconds;
      setCurrentTime(seconds);
    } catch {
      // Media not seekable yet.
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

    if (!isUsableDuration(audio.duration)) {
      await ensureFiniteDuration(audio);
    }

    try {
      await audio.play();
      setPlayError(null);
    } catch {
      setPlayError("Playback was blocked by the browser. Tap play again.");
    }
  }

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-3">
      <audio
        ref={audioRef}
        src={src ?? undefined}
        preload="auto"
        onLoadedMetadata={() => void handleLoadedMetadata()}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => {
          if (repairingRef.current) return;
          setPlaying(false);
          setCurrentTime(duration ?? 0);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          if (repairingRef.current) return;
          setPlaying(false);
        }}
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
          {playing ? (
            <Pause className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Play className="h-5 w-5" aria-hidden="true" />
          )}
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

      {playError ? <p className="mt-2 text-xs text-red-600">{playError}</p> : null}
      {!src && !loadError ? (
        <p className="mt-2 text-xs text-zinc-400">Loading audio…</p>
      ) : null}
    </div>
  );
}
