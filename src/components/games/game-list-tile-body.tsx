import { isGameUnplayed } from "@/components/games/game-tile-corner";
import { Lock } from "lucide-react";

export const GAME_LIST_TILE_CLASS = "flex flex-col items-center gap-1.5 text-center";

/** Icon, name and score for one game in a category's three-across grid. */
export function GameListTileBody({
  emoji,
  title,
  personalBest = null,
  lockedLabel = null,
}: {
  emoji: string;
  title: string;
  personalBest?: number | null;
  lockedLabel?: string | null;
}) {
  const locked = lockedLabel != null;
  const isNew = !locked && isGameUnplayed(personalBest);
  return (
    <>
      <span
        className={`relative flex h-[88px] w-[88px] items-center justify-center rounded-3xl text-[42px] ${
          locked ? "bg-zinc-100 grayscale" : "bg-[#F3EEFF]"
        }`}
        aria-hidden="true"
      >
        {emoji}
        {locked ? <Lock className="absolute right-2 top-2 h-4 w-4 text-zinc-500" /> : null}
      </span>
      <span className={`font-heading text-[13px] font-extrabold leading-tight ${locked ? "text-zinc-600" : "text-zinc-900"}`}>
        {title}
      </span>
      <span className={`text-[11px] font-semibold ${isNew ? "text-violet-700" : "text-zinc-600"}`}>
        {locked ? lockedLabel : isNew ? "New" : `Best: ${personalBest}`}
      </span>
    </>
  );
}
