import { NavLink } from "@/components/ui/nav-link";
import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";
import { BookOpen, CalendarDays, Languages, Sparkles, Wrench } from "lucide-react";
import type { ReactNode } from "react";

export type LearnHubTile =
  | {
      id: "foundational";
      kind: "link";
      href: string;
      title: string;
      status: string;
      percent: number | null;
      tone: "accent";
    }
  | {
      id: "beginners";
      kind: "link";
      href: string;
      title: string;
      status: string;
      tone: "amber";
    }
  | {
      id: "english";
      kind: "link";
      href: string;
      title: string;
      status: string;
      tone: "emerald";
    }
  | {
      id: "more";
      kind: "static";
      title: string;
      status: string;
      tone: "muted";
    }
  | {
      id: "resources";
      kind: "link";
      href: string;
      title: string;
      status: string;
      tone: "sky";
    };

/**
 * Colour roles:
 * - accent (violet soft wash): Foundational — Learn course brand accent
 * - amber: Beginners — warm wash, not Premium violet
 * - emerald: Learn English (private access)
 * - muted (zinc + faded): More courses — greyed-out placeholder
 * - sky: Resources
 */
const TONE_CLASS: Record<LearnHubTile["tone"], string> = {
  accent: "bg-violet-100 text-violet-950",
  amber: "bg-amber-100 text-amber-950",
  emerald: "bg-emerald-100 text-emerald-950",
  muted: "bg-zinc-100 text-zinc-500 opacity-70",
  sky: "bg-sky-100 text-sky-950",
};

const ICON_WRAP: Record<LearnHubTile["tone"], string> = {
  accent: "bg-violet-600/15 text-violet-700",
  amber: "bg-amber-600/15 text-amber-700",
  emerald: "bg-emerald-600/15 text-emerald-700",
  muted: "bg-zinc-900/8 text-zinc-400",
  sky: "bg-sky-600/15 text-sky-700",
};

function TileIcon({ id }: { id: LearnHubTile["id"] }) {
  const className = "h-6 w-6";
  switch (id) {
    case "foundational":
      return <BookOpen className={className} aria-hidden />;
    case "beginners":
      return <CalendarDays className={className} aria-hidden />;
    case "english":
      return <Languages className={className} aria-hidden />;
    case "more":
      return <Sparkles className={className} aria-hidden />;
    case "resources":
      return <Wrench className={className} aria-hidden />;
  }
}

function TileBody({
  tile,
  children,
}: {
  tile: LearnHubTile;
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
          <TileIcon id={tile.id} />
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

export function LearnCourseTiles({ tiles }: { tiles: LearnHubTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((tile) => {
        const tone = TONE_CLASS[tile.tone];

        if (tile.kind === "static") {
          return (
            <div
              key={tile.id}
              className={cn(tileShell, tone)}
              aria-disabled="true"
            >
              <TileBody tile={tile} />
            </div>
          );
        }

        return (
          <NavLink
            key={tile.id}
            href={tile.href}
            className={cn(pressableClass, tileShell, tone, "transition-opacity hover:opacity-95")}
          >
            <TileBody tile={tile}>
              {tile.id === "foundational" && tile.percent != null ? (
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold tabular-nums text-violet-800">
                  {tile.percent}%
                </span>
              ) : null}
            </TileBody>
          </NavLink>
        );
      })}
    </div>
  );
}
