import {
  CHADO_PAURI_RUNG_POINTS,
  CHADO_PAURI_RUNG_COUNT,
} from "@/lib/games/chado-pauri/config";

type ChadoPauriLadderProps = {
  currentRungIndex: number;
  lockedInScore: number;
};

export function ChadoPauriLadder({ currentRungIndex, lockedInScore }: ChadoPauriLadderProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Ladder
        </p>
        <p className="text-xs font-medium text-violet-600">
          Locked in: <span className="tabular-nums">{lockedInScore}</span> pts
        </p>
      </div>
      <ol className="flex flex-col-reverse gap-1">
        {CHADO_PAURI_RUNG_POINTS.map((points, index) => {
          const isCurrent = index === currentRungIndex;
          const isLocked = index < currentRungIndex;

          return (
            <li
              key={points}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all ${
                isCurrent
                  ? "bg-violet-100 font-semibold text-violet-900 ring-2 ring-violet-300 ring-offset-1"
                  : isLocked
                    ? "bg-green-50 text-green-800"
                    : "bg-zinc-50 text-zinc-500"
              }`}
            >
              <span>Rung {index + 1}</span>
              <span className="tabular-nums">{points} pts</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-center text-[11px] text-zinc-400">
        Rung {Math.min(currentRungIndex + 1, CHADO_PAURI_RUNG_COUNT)} of{" "}
        {CHADO_PAURI_RUNG_COUNT}
      </p>
    </div>
  );
}
