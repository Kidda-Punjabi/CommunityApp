"use client";

import type { CatchupSegment, SegmentActivityType } from "@/lib/catchup/types";

const ACTIVITY_LABELS: Record<SegmentActivityType, string> = {
  none: "Listen",
  quiz: "Quiz",
  flashcard_set: "Flashcards",
  game: "Game",
  homework: "Homework",
  external_link: "Link",
  fill_blank: "Fill blank",
  translate: "Translate",
  record_practice: "Speaking",
};

function activityIcon(type: SegmentActivityType): string {
  switch (type) {
    case "quiz":
      return "❓";
    case "flashcard_set":
      return "🃏";
    case "game":
      return "🎮";
    case "homework":
      return "📝";
    case "fill_blank":
    case "translate":
      return "✍️";
    case "record_practice":
      return "🎤";
    case "external_link":
      return "🔗";
    default:
      return "🎧";
  }
}

type CatchupSegmentNavProps = {
  segments: CatchupSegment[];
  activeIndex: number;
  onSelect: (index: number) => void;
};

export function CatchupSegmentNav({ segments, activeIndex, onSelect }: CatchupSegmentNavProps) {
  if (segments.length <= 1) return null;

  return (
    <details className="rounded-2xl border border-zinc-200 bg-white">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
        {segments.length} activities in this lesson
        <span className="ml-2 text-xs font-normal text-zinc-500">(tap to browse)</span>
      </summary>
      <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
        {segments.map((segment, index) => (
          <li key={segment.id}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-zinc-50 ${
                index === activeIndex ? "bg-violet-50" : ""
              }`}
            >
              <span className="text-base" aria-hidden="true">
                {activityIcon(segment.activityType)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium text-zinc-900">
                  {segment.segmentNumber}. {segment.title}
                </span>
                <span className="ml-2 text-xs text-zinc-500">
                  {ACTIVITY_LABELS[segment.activityType]}
                </span>
              </span>
              {segment.completed ? (
                <span className="text-xs font-medium text-emerald-600">Done</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
