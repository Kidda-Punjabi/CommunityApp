import { CatchupLucideIcon } from "@/lib/catchup/teaching-visuals/lucide-icon";
import type { ActivitySceneConfig } from "@/lib/catchup/teaching-visuals/types";

export function ActivitySceneVisual({ config }: { config: ActivitySceneConfig }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {config.icons.map((icon, index) => (
          <div
            key={`${icon}-${index}`}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200 bg-white shadow-sm sm:h-16 sm:w-16"
          >
            <CatchupLucideIcon name={icon} className="h-8 w-8 text-amber-600" />
          </div>
        ))}
      </div>
      <p className="mt-5 max-w-sm text-base font-semibold text-amber-900 sm:text-lg">
        {config.caption}
      </p>
    </div>
  );
}
