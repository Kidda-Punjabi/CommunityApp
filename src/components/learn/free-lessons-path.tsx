"use client";

import { Crown, Lock } from "lucide-react";
import Link from "next/link";
import { SingleMasteryRing } from "@/components/learn/single-mastery-ring";
import { getTopicVisual } from "@/lib/free-lessons/topic-visuals";
import type { TopicStageFills } from "@/lib/free-lessons/stages";
import type { TopicLockReason } from "@/lib/free-lessons/unlock";
import { PREMIUM_UNLOCK_PATH } from "@/lib/products/premium-checkout";

export type FreeLessonPathItem = {
  id: string;
  title: string;
  sortIndex: number;
  masteryLevel: number;
  fills: TopicStageFills;
  lockReason: TopicLockReason;
  needsPremium: boolean;
};

type FreeLessonsPathProps = {
  items: FreeLessonPathItem[];
};

function TopicNode({ item }: { item: FreeLessonPathItem }) {
  const visual = getTopicVisual(item.title, item.sortIndex);
  const { Icon } = visual;
  const locked = item.lockReason !== "none";
  const showPremiumCue = item.needsPremium && locked;
  const href =
    item.lockReason === "premium" ||
    (item.lockReason === "sequence" && item.needsPremium)
      ? PREMIUM_UNLOCK_PATH
      : item.lockReason === "none"
        ? `/dashboard/learn/free/${item.id}`
        : undefined;

  const emptyFills = { vocab: 0, sentences: 0, conversation: 0 };
  const fills = locked ? emptyFills : item.fills;
  const stagesComplete =
    (item.fills.vocab >= 100 ? 1 : 0) +
    (item.fills.sentences >= 100 ? 1 : 0) +
    (item.fills.conversation >= 100 ? 1 : 0);
  const mastered = !locked && stagesComplete === 3;

  const circle = (
    <SingleMasteryRing fills={fills} size={92} muted={locked}>
      <span
        className={`relative z-[1] flex h-[3.75rem] w-[3.75rem] items-center justify-center overflow-hidden rounded-full text-white shadow-md transition-transform duration-200 ${
          locked
            ? item.lockReason === "premium"
              ? "bg-violet-400"
              : "bg-zinc-300"
            : mastered
              ? "bg-violet-600 shadow-[0_6px_20px_-4px_rgba(124,58,237,0.6)]"
              : visual.fillClass
        } ${href ? "group-hover:scale-105 group-active:scale-95" : ""}`}
      >
        {locked ? (
          item.lockReason === "premium" ? (
            <Crown className="h-6 w-6 fill-white" strokeWidth={2} aria-hidden />
          ) : (
            <Lock className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          )
        ) : (
          <>
            <Icon
              className={`relative z-[1] h-6 w-6 ${
                mastered ? "topic-mastery-icon-shine" : ""
              }`}
              strokeWidth={2.25}
              aria-hidden
            />
            {mastered ? (
              <span
                aria-hidden
                className="topic-mastery-shine pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent"
              />
            ) : null}
          </>
        )}
      </span>
    </SingleMasteryRing>
  );

  const label = (
    <>
      <span className="mt-2.5 line-clamp-2 text-center text-sm font-semibold leading-snug text-zinc-900">
        {item.title}
      </span>
      {item.lockReason === "sequence" && !item.needsPremium ? (
        <span className="mt-1 text-center text-xs text-zinc-400">Keep going</span>
      ) : null}
      {showPremiumCue ? (
        <span className="mt-1 text-center text-xs font-medium text-violet-600">
          Unlocks with Premium
        </span>
      ) : null}
    </>
  );

  if (!href) {
    return (
      <div className="flex w-[7.5rem] flex-col items-center text-center opacity-80">
        {circle}
        {label}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group flex w-[7.5rem] flex-col items-center text-center outline-none"
    >
      {circle}
      {label}
    </Link>
  );
}

export function FreeLessonsPath({ items }: FreeLessonsPathProps) {
  return (
    <section>
      <ul className="mx-auto grid max-w-md grid-cols-2 justify-items-center gap-x-6 gap-y-8 sm:gap-x-10">
        {items.map((item, index) => (
          <li
            key={item.id}
            className={index === 0 ? "col-span-2 flex justify-center" : undefined}
          >
            <TopicNode item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}
