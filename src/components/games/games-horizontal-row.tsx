"use client";

import { ChevronRight } from "lucide-react";
import { ui } from "@/lib/ui/styles";

type GamesHorizontalRowProps = {
  title: string;
  children: React.ReactNode;
};

export function GamesHorizontalRow({ title, children }: GamesHorizontalRowProps) {
  return (
    <section>
      <h2 className={ui.sectionTitle}>{title}</h2>
      <div className="relative -mx-5">
        <div className="flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-zinc-50 from-30% via-zinc-50/95 to-transparent"
          aria-hidden="true"
        />
        <ChevronRight
          className="pointer-events-none absolute right-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-zinc-400"
          aria-hidden="true"
        />
      </div>
    </section>
  );
}

export const GAMES_TILE_WIDTH_CLASS = "w-[10.5rem] shrink-0";
