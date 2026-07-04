"use client";

import { UserAvatar } from "@/components/profile/user-avatar";
import { BATTLE_STARTING_HP } from "@/lib/battle/constants";
import type { BattlePlayerProfile } from "@/lib/battle/load-battle";
import { cn } from "@/lib/ui/styles";

export type PlayerConnectionStatus = "connected" | "reconnecting" | "disconnected" | "unknown";

type BattleVersusHudProps = {
  playerOne: BattlePlayerProfile;
  playerTwo: BattlePlayerProfile;
  playerOneHp: number;
  playerTwoHp: number;
  multiplier: number;
  youArePlayerOne: boolean;
  playerOneConnection: PlayerConnectionStatus;
  playerTwoConnection: PlayerConnectionStatus;
  /** Which side takes damage flash animation (player_one | player_two) */
  damageFlashSide?: "player_one" | "player_two" | null;
  /** Animated HP targets during damage reveal */
  displayPlayerOneHp?: number;
  displayPlayerTwoHp?: number;
  /** Floating damage number beside losing player's HP */
  floatingDamage?: { side: "player_one" | "player_two"; amount: number } | null;
};

function ConnectionDot({ status }: { status: PlayerConnectionStatus }) {
  const colors = {
    connected: "bg-emerald-500",
    reconnecting: "bg-amber-400 animate-pulse",
    disconnected: "bg-rose-500",
    unknown: "bg-zinc-300",
  };

  const labels = {
    connected: "Connected",
    reconnecting: "Reconnecting",
    disconnected: "Disconnected",
    unknown: "Unknown",
  };

  return (
    <span
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", colors[status])}
      title={labels[status]}
      aria-label={labels[status]}
    />
  );
}

function HpBarHalf({
  hp,
  side,
  highlight,
  flash,
}: {
  hp: number;
  side: "left" | "right";
  highlight?: boolean;
  flash?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (hp / BATTLE_STARTING_HP) * 100));

  return (
    <div
      className={cn(
        "relative h-4 flex-1 overflow-hidden bg-zinc-200 transition-colors duration-200",
        side === "left" ? "rounded-l-full" : "rounded-r-full",
        flash && "ring-2 ring-rose-400 ring-offset-1"
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 transition-[width] duration-[900ms] ease-out",
          highlight ? "bg-violet-600" : "bg-rose-500",
          side === "left" ? "left-0 rounded-l-full" : "right-0 rounded-r-full"
        )}
        style={{
          width: `${pct}%`,
        }}
      />
    </div>
  );
}

function PlayerHeader({
  player,
  hp,
  side,
  isYou,
  connection,
  floatingDamage,
}: {
  player: BattlePlayerProfile;
  hp: number;
  side: "left" | "right";
  isYou: boolean;
  connection: PlayerConnectionStatus;
  floatingDamage?: number;
}) {
  const avatar = (
    <UserAvatar
      profile={{
        full_name: player.displayName,
        preferred_name: null,
        avatar_url: player.avatarUrl,
      }}
      size="sm"
    />
  );

  const nameBlock = (
    <div className={cn("min-w-0", side === "right" && "text-right")}>
      <div
        className={cn(
          "flex items-center gap-1.5",
          side === "right" && "flex-row-reverse justify-end"
        )}
      >
        <ConnectionDot status={connection} />
        <p className="truncate text-sm font-semibold text-zinc-900">
          {player.displayName}
          {isYou ? (
            <span className="ml-1 text-xs font-normal text-violet-600">(you)</span>
          ) : null}
        </p>
      </div>
      <div
        className={cn(
          "mt-0.5 flex items-baseline gap-1.5",
          side === "right" && "flex-row-reverse justify-end"
        )}
      >
        <span className="text-lg font-bold tabular-nums text-zinc-900">{Math.max(0, hp)}</span>
        <span className="text-xs font-medium text-zinc-400">HP</span>
        {floatingDamage != null && floatingDamage > 0 ? (
          <span
            className={cn(
              "text-base font-bold tabular-nums text-rose-600 animate-bounce",
              side === "left" ? "ml-1" : "mr-1"
            )}
          >
            −{floatingDamage}
          </span>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2",
        side === "right" && "flex-row-reverse"
      )}
    >
      {avatar}
      {nameBlock}
    </div>
  );
}

export function BattleVersusHud({
  playerOne,
  playerTwo,
  playerOneHp,
  playerTwoHp,
  multiplier,
  youArePlayerOne,
  playerOneConnection,
  playerTwoConnection,
  damageFlashSide,
  displayPlayerOneHp,
  displayPlayerTwoHp,
  floatingDamage,
}: BattleVersusHudProps) {
  const leftHp = displayPlayerOneHp ?? playerOneHp;
  const rightHp = displayPlayerTwoHp ?? playerTwoHp;

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <PlayerHeader
          player={playerOne}
          hp={leftHp}
          side="left"
          isYou={youArePlayerOne}
          connection={playerOneConnection}
          floatingDamage={
            floatingDamage?.side === "player_one" ? floatingDamage.amount : undefined
          }
        />

        <div className="flex shrink-0 flex-col items-center px-1 pb-1">
          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">
            ×{multiplier.toFixed(1)}
          </span>
        </div>

        <PlayerHeader
          player={playerTwo}
          hp={rightHp}
          side="right"
          isYou={!youArePlayerOne}
          connection={playerTwoConnection}
          floatingDamage={
            floatingDamage?.side === "player_two" ? floatingDamage.amount : undefined
          }
        />
      </div>

      <div className="flex items-stretch gap-1.5">
        <HpBarHalf
          hp={leftHp}
          side="left"
          highlight={youArePlayerOne}
          flash={damageFlashSide === "player_one"}
        />
        <HpBarHalf
          hp={rightHp}
          side="right"
          highlight={!youArePlayerOne}
          flash={damageFlashSide === "player_two"}
        />
      </div>
    </div>
  );
}
