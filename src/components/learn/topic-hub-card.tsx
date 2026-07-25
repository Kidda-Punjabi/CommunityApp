"use client";

import { Crown } from "lucide-react";
import Link from "next/link";
import { getTopicVisual, TOPIC_MASTERY_MAX_LEVEL } from "@/lib/free-lessons/topic-visuals";

type TopicHubCardProps = {
  lessonId: string;
  title: string;
  sortIndex: number;
  masteryLevel: number;
  ringPercent: number;
  presentationUrl: string | null;
  hasPractice: boolean;
  activityTitle: string | null;
};

function ProgressRing({
  percent,
  color,
  size,
  stroke,
}: {
  percent: number;
  color: string;
  size: number;
  stroke: number;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, percent)) / 100);

  return (
    <svg
      width={size}
      height={size}
      className="absolute inset-0 -rotate-90"
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#E4E4E7"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

export function TopicHubCard({
  lessonId,
  title,
  sortIndex,
  masteryLevel,
  ringPercent,
  presentationUrl,
  hasPractice,
  activityTitle,
}: TopicHubCardProps) {
  const visual = getTopicVisual(title, sortIndex);
  const { Icon } = visual;
  const mastered = masteryLevel >= TOPIC_MASTERY_MAX_LEVEL;
  const displayRing = mastered ? 100 : ringPercent;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center text-center">
      <div className="relative inline-flex h-36 w-36 items-center justify-center">
        <ProgressRing
          percent={displayRing}
          color={visual.ringColor}
          size={144}
          stroke={10}
        />
        <span
          className={`relative z-[1] flex h-[6.5rem] w-[6.5rem] items-center justify-center rounded-full text-white shadow-lg ${visual.fillClass}`}
        >
          <Icon className="h-12 w-12" strokeWidth={2.25} aria-hidden />
        </span>
        <span
          className={`absolute bottom-1 right-1 z-[2] flex h-9 min-w-9 items-center justify-center gap-0.5 rounded-full border-2 border-white px-1.5 shadow ${
            masteryLevel > 0
              ? "bg-amber-400 text-amber-950"
              : "bg-zinc-200 text-zinc-400"
          }`}
        >
          <Crown
            className={`h-4 w-4 ${masteryLevel > 0 ? "fill-amber-950" : "fill-zinc-400"}`}
            aria-hidden
          />
          {masteryLevel > 0 ? (
            <span className="text-xs font-bold leading-none">
              {Math.min(TOPIC_MASTERY_MAX_LEVEL, masteryLevel)}
            </span>
          ) : null}
        </span>
      </div>

      <h1 className="mt-5 font-heading text-2xl font-semibold text-zinc-900">
        {title}
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        {mastered
          ? "You’ve mastered this topic. Practise again any time to stay sharp."
          : masteryLevel === 0
            ? "Start with an activity and build toward mastery."
            : `Level ${masteryLevel} of ${TOPIC_MASTERY_MAX_LEVEL} · keep going to fill the ring.`}
      </p>

      <div className="mt-8 flex w-full flex-col gap-3">
        {hasPractice ? (
          <Link
            href={`/dashboard/learn/free/${lessonId}/practice`}
            className="rounded-2xl bg-emerald-500 px-5 py-3.5 text-center text-sm font-semibold text-white hover:bg-emerald-600"
          >
            {mastered
              ? "Practise again"
              : masteryLevel === 0
                ? `Start · ${activityTitle ?? "Warm-up"}`
                : `Continue · ${activityTitle ?? "Next activity"}`}
          </Link>
        ) : (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Practice activities for this topic are coming soon.
          </p>
        )}

        {presentationUrl ? (
          <a
            href={presentationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Review lesson slides
          </a>
        ) : null}
      </div>
    </div>
  );
}
