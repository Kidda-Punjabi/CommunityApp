"use client";

import { Check, Lock } from "lucide-react";
import Link from "next/link";
import { getTopicVisual } from "@/lib/free-lessons/topic-visuals";
import type { EnglishFoundationsPathItem } from "@/lib/learning/english-foundations-path";

type EnglishFoundationsPathProps = {
  items: EnglishFoundationsPathItem[];
};

/**
 * Visual twin of Everyday Punjabi `FreeLessonsPath` (zigzag nodes, lock/check states).
 * Kept separate — no shared mutable state with the Punjabi path.
 */
function PathNode({ item }: { item: EnglishFoundationsPathItem }) {
  const visual = getTopicVisual(item.title, item.sortIndex);
  const { Icon } = visual;
  const locked = item.status === "locked";
  const complete = item.status === "complete";
  const active = item.status === "active";

  const href = active || complete ? `/dashboard/english/lesson/${item.id}` : undefined;

  const circle = (
    <span
      className={`relative flex h-[5.75rem] w-[5.75rem] items-center justify-center ${
        active ? "drop-shadow-[0_8px_20px_-6px_rgba(5,150,105,0.55)]" : ""
      }`}
    >
      <span
        className={`relative z-[1] flex h-[3.75rem] w-[3.75rem] items-center justify-center overflow-hidden rounded-full text-white shadow-md transition-transform duration-200 ${
          locked
            ? "bg-zinc-300"
            : complete
              ? "bg-emerald-600 shadow-[0_6px_20px_-4px_rgba(5,150,105,0.55)]"
              : visual.fillClass
        } ${href ? "group-hover:scale-105 group-active:scale-95" : ""} ${
          active ? "ring-4 ring-emerald-300/70" : ""
        }`}
      >
        {locked ? (
          <Lock className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        ) : complete ? (
          <Check className="h-7 w-7" strokeWidth={2.75} aria-hidden />
        ) : (
          <Icon className="relative z-[1] h-6 w-6" strokeWidth={2.25} aria-hidden />
        )}
      </span>
    </span>
  );

  const label = (
    <>
      <span className="mt-2.5 line-clamp-2 text-center text-sm font-semibold leading-snug text-zinc-900">
        {item.title}
      </span>
      {locked ? (
        <span className="mt-1 text-center text-xs text-zinc-400">Keep going</span>
      ) : null}
      {active ? (
        <span className="mt-1 text-center text-xs font-medium text-emerald-700">
          Continue
        </span>
      ) : null}
      {complete ? (
        <span className="mt-1 text-center text-xs font-medium text-emerald-600">
          Done
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

export function EnglishFoundationsPath({ items }: EnglishFoundationsPathProps) {
  return (
    <section>
      <ul className="mx-auto grid max-w-md grid-cols-2 justify-items-center gap-x-6 gap-y-8 sm:gap-x-10">
        {items.map((item, index) => (
          <li
            key={item.id}
            className={index === 0 ? "col-span-2 flex justify-center" : undefined}
          >
            <PathNode item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}
