"use client";

import { GAMES_FILTERS, type GamesFilter } from "@/lib/games/hub-config";
import { ui } from "@/lib/ui/styles";

type GamesFilterChipsProps = {
  active: GamesFilter;
  onChange: (filter: GamesFilter) => void;
};

export function GamesFilterChips({ active, onChange }: GamesFilterChipsProps) {
  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {GAMES_FILTERS.map((filter) => {
        const isActive = filter.id === active;
        return (
          <button
            key={filter.id}
            type="button"
            onClick={() => onChange(filter.id)}
            className={isActive ? ui.pillActive : ui.pillInactive}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
