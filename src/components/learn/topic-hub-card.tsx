"use client";

import { Layers, MessageCircle, PencilLine, Sparkles } from "lucide-react";
import Link from "next/link";
import { SingleMasteryRing } from "@/components/learn/single-mastery-ring";
import { getTopicVisual } from "@/lib/free-lessons/topic-visuals";
import {
  TOPIC_STAGES,
  type TopicStageFills,
  type TopicStageId,
} from "@/lib/free-lessons/stages";
import { PREMIUM_UNLOCK_PATH } from "@/lib/products/premium-checkout";

type TopicHubCardProps = {
  lessonId: string;
  title: string;
  sortIndex: number;
  stage: TopicStageId;
  depth: number;
  fills: TopicStageFills;
  hasPractice: boolean;
  activityTitle: string | null;
  vocabTotal: number;
  sentenceReady: boolean;
  accessible: boolean;
  lockReason: "none" | "sequence" | "premium";
};

export function TopicHubCard({
  lessonId,
  title,
  sortIndex,
  stage,
  depth,
  fills,
  hasPractice,
  activityTitle,
  vocabTotal,
  sentenceReady,
  accessible,
  lockReason,
}: TopicHubCardProps) {
  const visual = getTopicVisual(title, sortIndex);
  const { Icon } = visual;
  const mastered =
    fills.vocab >= 100 && fills.sentences >= 100 && fills.conversation >= 100;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center text-center">
      <div className="relative">
        <SingleMasteryRing
          fills={accessible ? fills : { vocab: 0, sentences: 0, conversation: 0 }}
          stage={accessible ? stage : 1}
          size={148}
          stroke={10}
          muted={!accessible}
        >
          <span
            className={`relative z-[1] flex h-[5.75rem] w-[5.75rem] items-center justify-center overflow-hidden rounded-full shadow-lg ${
              mastered
                ? "bg-violet-600 text-white shadow-[0_8px_28px_-6px_rgba(124,58,237,0.65)]"
                : `text-white ${visual.fillClass}`
            }`}
          >
            <Icon
              className={`relative z-[1] h-10 w-10 ${
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
          </span>
        </SingleMasteryRing>
      </div>

      <h1 className="mt-5 font-heading text-2xl font-semibold text-zinc-900">
        {title}
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        {lockReason === "sequence"
          ? "Finish the previous topic to unlock this one."
          : lockReason === "premium"
            ? "This topic is part of Premium. Unlock to keep practising in order."
            : mastered
              ? "All three stages complete — words, sentences, and speaking."
              : `Stage ${stage} of 3 · ${TOPIC_STAGES[stage - 1].label} (level ${depth} of 5)`}
      </p>

      <div className="mt-8 flex w-full flex-col gap-3 text-left">
        {lockReason === "premium" ? (
          <Link
            href={PREMIUM_UNLOCK_PATH}
            className="rounded-2xl bg-violet-600 px-5 py-3.5 text-center text-sm font-semibold text-white hover:bg-violet-500"
          >
            Unlock with Premium
          </Link>
        ) : null}

        {lockReason === "sequence" ? (
          <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center text-sm text-zinc-600">
            Complete the topics before this one first.
          </p>
        ) : null}

        {accessible ? (
          <>
            {hasPractice ? (
              <Link
                href={`/dashboard/learn/free/${lessonId}/practice`}
                className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3.5 hover:bg-violet-100/80"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                  <Sparkles className="h-4 w-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-zinc-900">
                    {mastered
                      ? "Practise again"
                      : activityTitle
                        ? `Continue · ${activityTitle}`
                        : "Continue"}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    Real games for this stage — match, tiles, and speaking.
                  </span>
                </span>
              </Link>
            ) : (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Practice activities for this topic are coming soon.
              </p>
            )}

            <Link
              href={`/dashboard/learn/free/${lessonId}/vocab`}
              className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
                stage === 1
                  ? "border-amber-200 bg-amber-50 hover:bg-amber-100/70"
                  : "border-zinc-200 bg-white hover:bg-zinc-50"
              }`}
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-white">
                <Layers className="h-4 w-4" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold text-zinc-900">
                  1 · Review Vocab
                </span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  {vocabTotal > 0
                    ? "Optional — browse words from this topic"
                    : "Vocab for this topic is coming soon."}
                </span>
              </span>
            </Link>

            {fills.vocab >= 100 || stage >= 2 ? (
              sentenceReady ? (
                <Link
                  href={`/dashboard/learn/free/${lessonId}/sentences`}
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
                    stage === 2
                      ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100/70"
                      : "border-zinc-200 bg-white hover:bg-zinc-50"
                  }`}
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
                    <PencilLine className="h-4 w-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-zinc-900">
                      2 · Sentence Building
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      Build phrases from this topic
                    </span>
                  </span>
                </Link>
              ) : (
                <div className="flex items-start gap-3 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3.5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-200 text-zinc-500">
                    <PencilLine className="h-4 w-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-zinc-700">
                      2 · Sentence Building
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      Needs multi-word phrases for this topic.
                    </span>
                  </span>
                </div>
              )
            ) : (
              <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 opacity-70">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-200 text-zinc-500">
                  <PencilLine className="h-4 w-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-zinc-700">
                    2 · Sentence Building
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    Unlocks after you clear the Vocab stage.
                  </span>
                </span>
              </div>
            )}

            {fills.sentences >= 100 || stage >= 3 ? (
              <Link
                href={`/dashboard/learn/free/${lessonId}/practice?stage=3`}
                className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
                  stage === 3
                    ? "border-violet-200 bg-violet-50 hover:bg-violet-100/70"
                    : "border-zinc-200 bg-white hover:bg-zinc-50"
                }`}
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                  <MessageCircle className="h-4 w-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-zinc-900">
                    3 · Speaking
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    Practise saying it out loud
                  </span>
                </span>
              </Link>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 opacity-70">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-200 text-zinc-500">
                  <MessageCircle className="h-4 w-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-zinc-700">
                    3 · Speaking
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    Unlocks after Sentence Building is complete.
                  </span>
                </span>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
