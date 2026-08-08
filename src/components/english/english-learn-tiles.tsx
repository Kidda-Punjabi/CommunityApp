import Link from "next/link";
import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";
import { Briefcase, CarFront, Flag, Home } from "lucide-react";
import type { ReactNode } from "react";

export type EnglishLearnTileTone = "emerald" | "teal" | "lime" | "cyan";

export type EnglishLearnTile = {
  id: string;
  href: string;
  title: string;
  status: string;
  tone: EnglishLearnTileTone;
  icon: EnglishLearnTileIcon;
};

export type EnglishLearnTileIcon = "flag" | "car" | "home" | "briefcase";

/**
 * Visual twin of the Punjabi Learn hub tiles (2×2 colored cards), emerald family only.
 * Kept separate so Punjabi LearnCourseTiles is never shared/mutated.
 */
const TONE_CLASS: Record<EnglishLearnTileTone, string> = {
  emerald: "bg-emerald-100 text-emerald-950",
  teal: "bg-teal-100 text-teal-950",
  lime: "bg-lime-100 text-lime-950",
  cyan: "bg-cyan-100 text-cyan-950",
};

const ICON_WRAP: Record<EnglishLearnTileTone, string> = {
  emerald: "bg-emerald-600/15 text-emerald-700",
  teal: "bg-teal-600/15 text-teal-700",
  lime: "bg-lime-600/15 text-lime-700",
  cyan: "bg-cyan-600/15 text-cyan-700",
};

function TileIcon({ icon }: { icon: EnglishLearnTileIcon }) {
  const className = "h-6 w-6";
  switch (icon) {
    case "flag":
      return <Flag className={className} aria-hidden />;
    case "car":
      return <CarFront className={className} aria-hidden />;
    case "home":
      return <Home className={className} aria-hidden />;
    case "briefcase":
      return <Briefcase className={className} aria-hidden />;
  }
}

function TileBody({
  tile,
  children,
}: {
  tile: EnglishLearnTile;
  children?: ReactNode;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl",
            ICON_WRAP[tile.tone]
          )}
        >
          <TileIcon icon={tile.icon} />
        </span>
        {children}
      </div>
      <div className="mt-auto">
        <p className="font-heading text-base font-semibold leading-snug">{tile.title}</p>
        <p className="mt-1 text-xs font-medium opacity-75">{tile.status}</p>
      </div>
    </>
  );
}

const tileShell =
  "flex aspect-[0.8] flex-col rounded-2xl p-4 shadow-[0_2px_16px_-4px_rgba(24,24,27,0.08)]";

export function EnglishLearnTiles({ tiles }: { tiles: EnglishLearnTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((tile) => (
        <Link
          key={tile.id}
          href={tile.href}
          prefetch={true}
          className={cn(
            pressableClass,
            tileShell,
            TONE_CLASS[tile.tone],
            "transition-opacity hover:opacity-95"
          )}
        >
          <TileBody tile={tile} />
        </Link>
      ))}
    </div>
  );
}

/** Map course title → icon without hardcoding course IDs. */
export function iconForEnglishLearnCourse(name: string): EnglishLearnTileIcon {
  const normalized = name.toLowerCase();
  if (normalized.includes("driving")) return "car";
  if (normalized.includes("living")) return "home";
  if (normalized.includes("work") || normalized.includes("job")) return "briefcase";
  if (normalized.includes("uk") || normalized.includes("life")) return "flag";
  return "flag";
}

const TONE_CYCLE: EnglishLearnTileTone[] = ["emerald", "teal", "lime", "cyan"];

export function toneForEnglishLearnIndex(index: number): EnglishLearnTileTone {
  return TONE_CYCLE[index % TONE_CYCLE.length]!;
}

export function statusForEnglishLearnCourse(
  lessonCount: number,
  courseName?: string
): string {
  if (courseName) {
    const name = courseName.toLowerCase();
    if (name.includes("driving") || name.includes("life in the uk") || (name.includes("life") && name.includes("uk"))) {
      return "Materials · Practice · Mock";
    }
  }
  if (lessonCount <= 0) return "Coming soon";
  return `${lessonCount} lesson${lessonCount === 1 ? "" : "s"}`;
}
