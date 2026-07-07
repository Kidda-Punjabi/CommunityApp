export function isGameUnplayed(personalBest: number | null | undefined): boolean {
  return !(personalBest != null && personalBest > 0);
}

export function GameTileCornerBadge({
  personalBest,
}: {
  personalBest: number | null | undefined;
}) {
  if (!isGameUnplayed(personalBest)) return null;

  return (
    <span className="inline-flex shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
      New
    </span>
  );
}
