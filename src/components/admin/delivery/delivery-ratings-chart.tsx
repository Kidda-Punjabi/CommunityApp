"use client";

import type { DeliveryChartPoint } from "@/lib/admin/delivery/types";

const SERIES = [
  { key: "learningRelevance" as const, label: "Learning relevance", color: "#7c3aed" },
  { key: "confidence" as const, label: "Confidence", color: "#0891b2" },
  { key: "tutorEffectiveness" as const, label: "Tutor effectiveness", color: "#d97706" },
];

export function DeliveryRatingsChart({ points }: { points: DeliveryChartPoint[] }) {
  const width = 640;
  const height = 220;
  const pad = { top: 16, right: 16, bottom: 36, left: 32 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const values = points.flatMap((point) =>
    [point.learningRelevance, point.confidence, point.tutorEffectiveness].filter(
      (value): value is number => value != null
    )
  );
  const min = 1;
  const max = Math.max(5, ...values, 5);

  function x(index: number): number {
    if (points.length <= 1) return pad.left + innerW / 2;
    return pad.left + (index / (points.length - 1)) * innerW;
  }
  function y(value: number): number {
    return pad.top + innerH - ((value - min) / (max - min)) * innerH;
  }

  if (points.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-zinc-500">
        No rated feedback in this range.
      </p>
    );
  }

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img">
        <title>Learning relevance, confidence, and tutor effectiveness over time</title>
        {[1, 2, 3, 4, 5].map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#f4f4f5"
            />
            <text x={4} y={y(tick) + 4} className="fill-zinc-400" fontSize="10">
              {tick}
            </text>
          </g>
        ))}
        {SERIES.map((series) => {
          const d = points
            .map((point, index) => {
              const value = point[series.key];
              if (value == null) return null;
              return `${index === 0 || points.slice(0, index).every((p) => p[series.key] == null) ? "M" : "L"} ${x(index)} ${y(value)}`;
            })
            .filter(Boolean)
            .join(" ")
            .replace(/^L/, "M");
          return (
            <path
              key={series.key}
              d={d}
              fill="none"
              stroke={series.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}
        {points.map((point, index) => (
          <text
            key={point.key}
            x={x(index)}
            y={height - 10}
            textAnchor="middle"
            className="fill-zinc-400"
            fontSize="10"
          >
            {point.label}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 px-1 text-xs font-medium text-zinc-600">
        {SERIES.map((series) => (
          <span key={series.key} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: series.color }} />
            {series.label}
          </span>
        ))}
      </div>
    </div>
  );
}
