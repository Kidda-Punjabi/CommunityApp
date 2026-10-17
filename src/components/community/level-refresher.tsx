"use client";

import { checkRefresherAnswer } from "@/app/dashboard/community/level/actions";
import { ExamplePlay } from "@/components/community/example-play";
import Link from "next/link";
import { useState } from "react";

type Item = {
  id: string;
  prompt: string;
  roman: string | null;
  audioUrl: string | null;
  options: { id: string; label: string }[];
};

export function LevelRefresher({ level, items }: { level: number; items: Item[] }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correctId, setCorrectId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const item = items[index];

  if (done || !item) {
    return (
      <div className="flex h-[calc(100dvh-5.5rem-env(safe-area-inset-bottom))] flex-col justify-between bg-[#F7F5FC] font-[family-name:var(--font-community)] text-[#1F1640]">
        <div>
          <Link href={`/dashboard/community/level/${level}`} className="inline-flex h-11 items-center text-sm font-semibold text-[#4A3F66]">Back</Link>
          <h1 className="font-heading text-3xl font-extrabold">Refresher done</h1>
          <p className="mt-2 text-sm text-[#4A3F66]">{score} of {items.length} on this practice. Your level stays the same.</p>
        </div>
        <Link href={`/dashboard/community/level/${level}`} className="mb-3 flex h-14 items-center justify-center rounded-[18px] bg-[#7C3AED] font-bold text-white">Back to Level {level}</Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-5.5rem-env(safe-area-inset-bottom))] flex-col bg-[#F7F5FC] font-[family-name:var(--font-community)] text-[#1F1640]">
      <Link href={`/dashboard/community/level/${level}`} className="inline-flex h-11 items-center text-sm font-semibold text-[#4A3F66]">Back</Link>
      <p className="text-xs font-bold text-[#6B5F8A]">Level {level} refresher · {index + 1} of {items.length}</p>
      <h1 className="mt-2 font-heading text-2xl font-extrabold">{item.prompt}</h1>
      <div className="mt-3 flex items-center gap-2">
        <ExamplePlay url={item.audioUrl} />
        {item.roman ? <p className="text-sm font-semibold">{item.roman}</p> : null}
      </div>
      <div className="mt-3 space-y-2">
        {item.options.map((option) => {
          const tone = correctId == null ? "bg-white" : option.id === correctId ? "bg-emerald-100" : option.id === picked ? "bg-red-100" : "bg-white";
          return (
            <button
              key={option.id}
              type="button"
              disabled={picked != null}
              onClick={() => {
                setPicked(option.id);
                void checkRefresherAnswer(item.id, option.id).then((result) => {
                  if ("error" in result && result.error) return;
                  setCorrectId(result.correctOptionId ?? null);
                  const nextScore = score + (result.correct ? 1 : 0);
                  setScore(nextScore);
                  window.setTimeout(() => {
                    if (index + 1 >= items.length) setDone(true);
                    else {
                      setIndex(index + 1);
                      setPicked(null);
                      setCorrectId(null);
                    }
                  }, 700);
                });
              }}
              className={`flex h-14 w-full items-center rounded-[18px] px-4 text-left text-sm font-semibold ${tone}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
