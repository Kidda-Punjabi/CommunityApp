"use client";

import type { TopicStageFills } from "@/lib/free-lessons/stages";
import { TOPIC_STAGES } from "@/lib/free-lessons/stages";

type TripleMasteryRingsProps = {
  fills: TopicStageFills;
  size?: number;
  children?: React.ReactNode;
};

/**
 * Three concentric rings: vocab (inner, red), sentences (middle, yellow),
 * conversation (outer, green).
 */
export function TripleMasteryRings({
  fills,
  size = 92,
  children,
}: TripleMasteryRingsProps) {
  const rings = [
    { key: "vocab" as const, color: TOPIC_STAGES[0].ringColor, width: 7 },
    { key: "sentences" as const, color: TOPIC_STAGES[1].ringColor, width: 7 },
    {
      key: "conversation" as const,
      color: TOPIC_STAGES[2].ringColor,
      width: 7,
    },
  ];

  const gap = 3;
  const outerPad = 2;

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
        {rings.map((ring, index) => {
          // Outer ring = conversation (index 2), inner = vocab (index 0)
          const ringIndexFromOutside = rings.length - 1 - index;
          const inset =
            outerPad +
            ringIndexFromOutside * (ring.width + gap) +
            ring.width / 2;
          const diameter = size - inset * 2;
          const radius = diameter / 2;
          const circumference = 2 * Math.PI * radius;
          const percent = Math.max(0, Math.min(100, fills[ring.key]));
          const offset = circumference * (1 - percent / 100);

          return (
            <g key={ring.key}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#E4E4E7"
                strokeWidth={ring.width}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={ring.color}
                strokeWidth={ring.width}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-[stroke-dashoffset] duration-500 ease-out"
              />
            </g>
          );
        })}
      </svg>
      {children}
    </span>
  );
}
