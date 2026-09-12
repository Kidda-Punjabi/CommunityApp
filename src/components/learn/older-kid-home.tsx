"use client";

import { useState } from "react";
import { NavLink } from "@/components/ui/nav-link";
import { RegisterInterestButton } from "@/components/learn/register-interest-button";
import { LEARN_COURSE_LEVELS } from "@/lib/learn/course-levels";
import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";
import { Award, Lock, Wrench } from "lucide-react";

type OlderKidBeginnerCardProps = {
  level1Href: string | null;
  level1Percent: number | null;
};

export function OlderKidBeginnerCard({
  level1Href,
  level1Percent,
}: OlderKidBeginnerCardProps) {
  const theme = LEARN_COURSE_LEVELS.beginners;

  return (
    <div
      className={cn(
        "rounded-3xl p-4 shadow-[0_2px_16px_-4px_rgba(24,24,27,0.08)]",
        theme.rowBg
      )}
    >
      <p className={cn("font-heading text-base font-semibold", theme.ink)}>Beginner</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {level1Href ? (
          <NavLink
            href={level1Href}
            className={cn(
              pressableClass,
              "rounded-2xl px-2 py-2.5 text-center",
              theme.rowBg,
              "ring-1 ring-black/5"
            )}
          >
            <p className={cn("text-xs font-bold", theme.ink)}>Level 1</p>
            <p className={cn("mt-1 text-[11px] font-semibold tabular-nums", theme.mutedInk)}>
              {level1Percent != null ? `${level1Percent}%` : "Open"}
            </p>
          </NavLink>
        ) : (
          <div className={cn("rounded-2xl px-2 py-2.5 text-center ring-1 ring-black/5", theme.rowBg)}>
            <p className={cn("text-xs font-bold", theme.ink)}>Level 1</p>
            <p className={cn("mt-1 text-[11px] font-semibold", theme.mutedInk)}>No class yet</p>
          </div>
        )}
        <LockedLevelChip label="Level 2" />
        <LockedLevelChip label="Level 3" />
      </div>
    </div>
  );
}

function LockedLevelChip({ label }: { label: string }) {
  const [hint, setHint] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setHint(true)}
      className="rounded-2xl bg-white/50 px-2 py-2.5 text-center text-zinc-500"
    >
      <p className="flex items-center justify-center gap-1 text-xs font-bold">
        <Lock className="h-3 w-3" aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-[11px] font-semibold">{hint ? "Not available yet" : "Locked"}</p>
    </button>
  );
}

type OlderKidComingSoonRowProps = {
  title: string;
  courseLevel: "kids_intermediate" | "kids_advanced";
  interestRegistered: boolean;
};

export function OlderKidComingSoonRow({
  title,
  courseLevel,
  interestRegistered,
}: OlderKidComingSoonRowProps) {
  return (
    <div className="flex min-h-[60px] items-center gap-2 rounded-2xl bg-zinc-100 px-3 py-2 shadow-[0_1px_8px_-4px_rgba(24,24,27,0.06)]">
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-semibold text-zinc-600">{title}</p>
        <p className="mt-0.5 text-[11px] font-medium text-zinc-500">Coming soon</p>
      </div>
      <RegisterInterestButton
        courseTitle={title}
        courseLevel={courseLevel}
        compact
        initiallyRegistered={interestRegistered}
        className="bg-zinc-500 text-white hover:bg-zinc-600"
      />
    </div>
  );
}

export function OlderKidSecondaryTiles() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <NavLink
        href="/dashboard/learn/certificates"
        className={cn(
          pressableClass,
          "flex min-h-[7.5rem] flex-col rounded-2xl bg-[#F5F3FF] p-3.5 text-[#2E1065] shadow-[0_1px_8px_-4px_rgba(24,24,27,0.06)]"
        )}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7C3AED]/15 text-[#6D28D9]">
          <Award className="h-5 w-5" aria-hidden />
        </span>
        <p className="mt-auto font-heading text-sm font-semibold">Certificates</p>
        <p className="mt-0.5 text-[11px] font-medium text-[#5B21B6]/80">View your awards</p>
      </NavLink>
      <NavLink
        href="/dashboard/learn/resources"
        className={cn(
          pressableClass,
          "flex min-h-[7.5rem] flex-col rounded-2xl bg-sky-100 p-3.5 text-sky-950 shadow-[0_1px_8px_-4px_rgba(24,24,27,0.06)]"
        )}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600/15 text-sky-700">
          <Wrench className="h-5 w-5" aria-hidden />
        </span>
        <p className="mt-auto font-heading text-sm font-semibold">Resources</p>
        <p className="mt-0.5 text-[11px] font-medium text-sky-800/80">Tools & shortcuts</p>
      </NavLink>
    </div>
  );
}
