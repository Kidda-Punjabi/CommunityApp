import { ui } from "@/lib/ui/styles";

type TabPageSkeletonProps = {
  rows?: number;
  showHero?: boolean;
};

export function TabPageSkeleton({ rows = 4, showHero = false }: TabPageSkeletonProps) {
  return (
    <div className={`${ui.page} animate-pulse`} aria-busy="true" aria-label="Loading">
      <div className="mb-8 space-y-2">
        <div className="h-8 w-36 rounded-lg bg-zinc-200" />
        <div className="h-4 w-full max-w-sm rounded bg-zinc-100" />
      </div>

      {showHero ? (
        <div className="mb-6 h-28 rounded-2xl bg-violet-100" />
      ) : null}

      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-[4.5rem] rounded-2xl bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}
