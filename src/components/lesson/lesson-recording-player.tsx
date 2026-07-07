"use client";

import { recordingEmbedUrl } from "@/lib/tutoring/lesson-content-access";

type LessonRecordingPlayerProps = {
  url: string;
  title?: string | null;
};

function isDirectVideoUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(trimmed) ||
    trimmed.includes("/storage/v1/object/public/") ||
    trimmed.includes("/storage/v1/object/sign/")
  );
}

export function LessonRecordingPlayer({ url, title }: LessonRecordingPlayerProps) {
  const trimmed = url.trim();
  const embedUrl = recordingEmbedUrl(trimmed);

  if (isDirectVideoUrl(trimmed)) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-900">
          {title?.trim() || "Session recording"}
        </p>
        <video
          src={trimmed}
          controls
          playsInline
          className="w-full rounded-xl border border-zinc-200 bg-black"
        >
          <track kind="captions" />
        </video>
      </div>
    );
  }

  if (embedUrl) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-900">
          {title?.trim() || "Session recording"}
        </p>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
          <iframe
            src={embedUrl}
            title={title?.trim() || "Session recording"}
            className="aspect-video w-full"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-zinc-900">
        {title?.trim() || "Session recording"}
      </p>
      <a
        href={trimmed}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        Open recording
      </a>
    </div>
  );
}
