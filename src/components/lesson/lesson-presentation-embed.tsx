"use client";

import { googleSlidesEmbedUrl } from "@/lib/learning/google-slides-embed";
import { useRef } from "react";

type LessonPresentationEmbedProps = {
  presentationUrl: string;
};

export function LessonPresentationEmbed({ presentationUrl }: LessonPresentationEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const embedUrl = googleSlidesEmbedUrl(presentationUrl);

  if (!embedUrl) {
    return (
      <p className="text-sm text-zinc-500">
        Could not embed this presentation.{" "}
        <a
          href={presentationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-violet-600 hover:text-violet-500"
        >
          Open in Google Slides
        </a>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-900">Presentation</p>
        <button
          type="button"
          onClick={() => void containerRef.current?.requestFullscreen()}
          className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          Fullscreen
        </button>
      </div>
      <div
        ref={containerRef}
        className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100"
      >
        <iframe
          src={embedUrl}
          title="Lesson presentation"
          className="aspect-video w-full bg-white"
          allowFullScreen
        />
      </div>
    </div>
  );
}
