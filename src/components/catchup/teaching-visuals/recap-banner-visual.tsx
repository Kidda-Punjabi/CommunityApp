import { CatchupLucideIcon } from "@/lib/catchup/teaching-visuals/lucide-icon";
import type { RecapBannerConfig } from "@/lib/catchup/teaching-visuals/types";

export function RecapBannerVisual({ config }: { config: RecapBannerConfig }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-200 bg-white shadow-sm">
        <CatchupLucideIcon name={config.icon} className="h-9 w-9 text-emerald-600" />
      </div>
      <p className="mt-5 text-xl font-bold text-emerald-900">{config.heading}</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-emerald-800">
        {config.subheading}
      </p>
    </div>
  );
}
