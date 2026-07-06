"use client";

import { KidLucideIcon } from "@/components/kids/kid-lucide-icon";
import { STICKER_CATALOG } from "@/lib/kids/constants";
import type { KidSticker } from "@/lib/kids/types";

export function StickerBook({ earned }: { earned: KidSticker[] }) {
  const earnedIcons = new Set(earned.map((s) => s.sticker_icon));

  return (
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
      {STICKER_CATALOG.map((entry) => {
        const owned = earnedIcons.has(entry.icon);
        const sticker = earned.find((s) => s.sticker_icon === entry.icon);
        return (
          <div
            key={entry.icon}
            className={`flex flex-col items-center rounded-2xl p-3 text-center ${
              owned ? "bg-amber-50 ring-2 ring-amber-200" : "bg-zinc-100 opacity-50"
            }`}
          >
            <KidLucideIcon
              name={entry.icon}
              className={`h-10 w-10 ${owned ? "text-amber-500" : "text-zinc-300"}`}
            />
            <span className="mt-2 text-[10px] font-semibold leading-tight text-zinc-700">
              {owned ? sticker?.sticker_name ?? entry.name : "???"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
