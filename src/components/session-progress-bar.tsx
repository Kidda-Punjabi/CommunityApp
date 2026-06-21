type SessionProgressBarProps = {
  /** 1-based index of the current question or step */
  current: number;
  total: number;
};

export function SessionProgressBar({ current, total }: SessionProgressBarProps) {
  if (total <= 0) return null;

  const pct = Math.min(100, Math.max(0, (current / total) * 100));

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50"
      role="progressbar"
      aria-valuenow={Math.max(current, 0)}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Question ${current} of ${total}`}
    >
      <div className="mx-auto h-1.5 max-w-lg overflow-hidden bg-zinc-100">
        <div
          className="h-full bg-violet-600 transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
