import { CatchupLucideIcon } from "@/lib/catchup/teaching-visuals/lucide-icon";
import type { QuizBannerConfig } from "@/lib/catchup/teaching-visuals/types";

export function QuizBannerVisual({ config }: { config: QuizBannerConfig }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 px-6 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-200 bg-white shadow-sm">
        <CatchupLucideIcon name={config.icon} className="h-9 w-9 text-sky-600" />
      </div>
      <p className="mt-5 text-xl font-bold text-sky-900">{config.heading}</p>
    </div>
  );
}
