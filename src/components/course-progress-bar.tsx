type CourseProgressBarProps = {
  completed: number;
  total: number;
  className?: string;
};

export function CourseProgressBar({
  completed,
  total,
  className = "",
}: CourseProgressBarProps) {
  if (total === 0) return null;

  const percentage = Math.round((completed / total) * 100);

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-zinc-600">
          {completed} of {total} lesson{total === 1 ? "" : "s"} complete
        </span>
        <span className="font-semibold text-violet-600">{percentage}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-violet-100">
        <div
          className="h-full rounded-full bg-violet-600 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
