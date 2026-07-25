"use client";

import {
  TOPIC_STAGES,
  type TopicStageFills,
  type TopicStageId,
} from "@/lib/free-lessons/stages";

type SingleMasteryRingProps = {
  fills: TopicStageFills;
  /** When set, forces which stage colour to show (e.g. locked = muted). */
  stage?: TopicStageId;
  size?: number;
  stroke?: number;
  muted?: boolean;
  children?: React.ReactNode;
};

function activeStageFromFills(fills: TopicStageFills): TopicStageId {
  if (fills.vocab < 100) return 1;
  if (fills.sentences < 100) return 2;
  return 3;
}

function fillPercentForStage(fills: TopicStageFills, stage: TopicStageId): number {
  if (stage === 1) return fills.vocab;
  if (stage === 2) return fills.sentences;
  return fills.conversation;
}

/**
 * One progress ring — colour matches the current mastery stage
 * (yellow → green → Kidda purple).
 */
export function SingleMasteryRing({
  fills,
  stage: stageOverride,
  size = 92,
  stroke = 8,
  muted = false,
  children,
}: SingleMasteryRingProps) {
  const stage = stageOverride ?? activeStageFromFills(fills);
  const percent = muted ? 0 : fillPercentForStage(fills, stage);
  const color = muted ? "#D4D4D8" : TOPIC_STAGES[stage - 1].ringColor;

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, percent)) / 100);

  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
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
          className="transition-[stroke-dashoffset,stroke] duration-500 ease-out"
        />
      </svg>
      {children}
    </span>
  );
}
