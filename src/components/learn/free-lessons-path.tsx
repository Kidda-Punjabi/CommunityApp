"use client";

import { Crown, Lock } from "lucide-react";
import Link from "next/link";
import { TripleMasteryRings } from "@/components/learn/triple-mastery-rings";
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
  // Crown shows completed stages (0–3)
  const stagesComplete =
    (item.fills.vocab >= 100 ? 1 : 0) +
    (item.fills.sentences >= 100 ? 1 : 0) +
    (item.fills.conversation >= 100 ? 1 : 0);

  const circle = (
    <TripleMasteryRings fills={fills} size={92}>
      <span
        className={`relative z-[1] flex h-[3.35rem] w-[3.35rem] items-center justify-center rounded-full text-white shadow-md transition-transform duration-200 ${
          locked
            ? item.lockReason === "premium"
              ? "bg-violet-400"
              : "bg-zinc-300"
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
          <Icon className="h-6 w-6" strokeWidth={2.25} aria-hidden />
        )}
      </span>
      {!locked && stagesComplete > 0 ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 z-[2] flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-full border-2 border-white bg-amber-400 px-1 text-amber-950 shadow-sm"
          aria-label={`${stagesComplete} of 3 stages complete`}
        >
          <Crown className="h-3.5 w-3.5 fill-amber-950" aria-hidden />
          <span className="text-[10px] font-bold leading-none">{stagesComplete}</span>
        </span>
      ) : null}
    </TripleMasteryRings>
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
      <div className="mb-6 text-center">
        <h2 className="font-heading text-xl font-semibold text-zinc-900">
          Everyday Punjabi
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Three rings per topic — words, sentences, then conversation.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[11px] font-medium">
          <span className="inline-flex items-center gap-1.5 text-rose-600">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> Vocab
          </span>
          <span className="inline-flex items-center gap-1.5 text-amber-600">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Sentences
          </span>
          <span className="inline-flex items-center gap-1.5 text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Conversation
          </span>
        </div>
      </div>

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
