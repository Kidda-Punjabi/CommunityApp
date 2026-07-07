"use client";

import {
  Car,
  CloudSun,
  GraduationCap,
  HeartPulse,
  Home,
  PawPrint,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import {
  DICTIONARY_EXPLORE_CATEGORIES,
  type DictionaryExploreCategory,
} from "@/lib/resources/dictionary";
import { pressableClass } from "@/lib/ui/pressable";

const ICONS: Record<DictionaryExploreCategory["icon"], LucideIcon> = {
  utensils: Utensils,
  users: Users,
  "paw-print": PawPrint,
  "heart-pulse": HeartPulse,
  home: Home,
  car: Car,
  "cloud-sun": CloudSun,
  "graduation-cap": GraduationCap,
};

type DictionaryExploreCategoriesProps = {
  counts: Record<string, number>;
  onSelect: (categoryId: string) => void;
};

export function DictionaryExploreCategories({
  counts,
  onSelect,
}: DictionaryExploreCategoriesProps) {
  const visibleCategories = DICTIONARY_EXPLORE_CATEGORIES.filter(
    (category) => (counts[category.id] ?? 0) > 0
  );

  if (visibleCategories.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Explore by topic</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Pick a theme to browse a handful of related words
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {visibleCategories.map((category) => {
          const Icon = ICONS[category.icon];
          const count = counts[category.id] ?? 0;

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect(category.id)}
              className={`${pressableClass} flex min-h-[7.5rem] flex-col items-start rounded-2xl border border-zinc-200/80 bg-white p-4 text-left shadow-[0_2px_16px_-4px_rgba(24,24,27,0.06)] transition-all hover:border-violet-200 hover:bg-violet-50/30`}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600"
                aria-hidden="true"
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <p className="mt-3 text-sm font-semibold leading-snug text-zinc-900">
                {category.label}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {count} word{count === 1 ? "" : "s"}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
