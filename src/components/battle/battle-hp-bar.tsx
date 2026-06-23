"use client";

import { BATTLE_STARTING_HP } from "@/lib/battle/constants";
import { cn } from "@/lib/ui/styles";

type BattleHpBarProps = {
  label: string;
  hp: number;
  align?: "left" | "right";
  highlight?: boolean;
};

export function BattleHpBar({ label, hp, align = "left", highlight }: BattleHpBarProps) {
  const pct = Math.max(0, Math.min(100, (hp / BATTLE_STARTING_HP) * 100));

  return (
    <div className={cn("space-y-1", align === "right" && "text-right")}>
      <div className={cn("flex items-center gap-2", align === "right" && "flex-row-reverse")}>
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        <span className="text-sm font-bold text-zinc-900">{Math.max(0, hp)} HP</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-zinc-200">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            highlight ? "bg-violet-600" : "bg-rose-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
