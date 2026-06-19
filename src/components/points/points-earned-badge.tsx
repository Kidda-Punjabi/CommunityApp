type PointsEarnedBadgeProps = {
  points: number;
  className?: string;
};

export function PointsEarnedBadge({ points, className = "" }: PointsEarnedBadgeProps) {
  if (points <= 0) return null;

  return (
    <p
      className={`inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-700 ${className}`}
    >
      <span aria-hidden="true">+</span>
      {points} points
    </p>
  );
}
