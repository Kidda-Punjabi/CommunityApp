"use client";

import { Crown } from "lucide-react";
import Link from "next/link";
import { getTopicVisual } from "@/lib/free-lessons/topic-visuals";

export type FreeLessonPathItem = {
  id: string;
  title: string;
  sortIndex: number;
  masteryLevel: number;
  /** 0–100 fill of the ring toward the next level */
  ringPercent: number;
};

type FreeLessonsPathProps = {
  items: FreeLessonPathItem[];
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
        className="transition-[stroke-dashoffset] duration-500 ease-out"
      />
    </svg>
  );
}

export function FreeLessonsPath({ items }: FreeLessonsPathProps) {
  return (
    <section>
      <div className="mb-6">
        <h2 className="font-heading text-xl font-semibold text-zinc-900">
          Practical Punjabi
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Pick a topic and practise until you master it — at your own pace.
        </p>
      </div>

      <ul className="mx-auto grid max-w-md grid-cols-2 gap-x-6 gap-y-8 sm:gap-x-10">
        {items.map((item, index) => {
          const visual = getTopicVisual(item.title, item.sortIndex);
          const { Icon } = visual;
          const mastered = item.masteryLevel >= 5;
          const crownLevel = Math.min(5, item.masteryLevel);
          const ringPercent = mastered ? 100 : item.ringPercent;
          // First item spans full width (Duolingo-style lead-in).
          const leadIn = index === 0;

          return (
            <li
              key={item.id}
              className={leadIn ? "col-span-2 flex justify-center" : undefined}
            >
              <Link
                href={`/dashboard/learn/free/${item.id}`}
                className="group flex w-[7.5rem] flex-col items-center text-center outline-none"
              >
                <span className="relative inline-flex h-[5.75rem] w-[5.75rem] items-center justify-center">
                  <ProgressRing
                    percent={ringPercent}
                    color={visual.ringColor}
                    size={92}
                    stroke={7}
                  />
                  <span
                    className={`relative z-[1] flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full text-white shadow-md transition-transform duration-200 group-hover:scale-105 group-active:scale-95 ${visual.fillClass}`}
                  >
                    <Icon className="h-8 w-8" strokeWidth={2.25} aria-hidden />
                  </span>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 z-[2] flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-full border-2 border-white px-1 shadow-sm ${
                      crownLevel > 0
                        ? "bg-amber-400 text-amber-950"
                        : "bg-zinc-200 text-zinc-400"
                    }`}
                    aria-label={
                      crownLevel > 0
                        ? `Mastery level ${crownLevel}`
                        : "Not started"
                    }
                  >
                    <Crown
                      className={`h-3.5 w-3.5 ${
                        crownLevel > 0 ? "fill-amber-950" : "fill-zinc-400"
                      }`}
                      aria-hidden
                    />
                    {crownLevel > 0 ? (
                      <span className="text-[10px] font-bold leading-none">
                        {crownLevel}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="mt-2.5 line-clamp-2 text-sm font-semibold leading-snug text-zinc-900">
                  {item.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
