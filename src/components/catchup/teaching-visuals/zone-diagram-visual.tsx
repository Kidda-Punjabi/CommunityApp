import { CatchupLucideIcon } from "@/lib/catchup/teaching-visuals/lucide-icon";
import { accentStyle } from "@/lib/catchup/teaching-visuals/colors";
import type { ZoneDiagramConfig } from "@/lib/catchup/teaching-visuals/types";

export function ZoneDiagramVisual({ config }: { config: ZoneDiagramConfig }) {
  return (
    <div className="aspect-video w-full rounded-2xl border border-zinc-200 bg-white px-3 py-5 sm:px-5">
      <div className="grid h-full grid-cols-3 gap-2 sm:gap-3">
        {config.zones.map((zone, index) => {
          const style = accentStyle(zone.color);
          return (
            <div key={`${zone.label}-${index}`} className="flex min-w-0 flex-col items-center text-center">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-2xl border sm:h-20 sm:w-20 ${style.surface} ${style.border}`}
              >
                <CatchupLucideIcon name={zone.icon} className={`h-8 w-8 sm:h-9 sm:w-9 ${style.icon}`} />
              </div>
              <p className={`mt-3 text-xs font-semibold sm:text-sm ${style.text}`}>{zone.label}</p>
              <p className="mt-1 text-[10px] leading-snug text-zinc-500 sm:text-xs">{zone.sublabel}</p>
              {index < config.zones.length - 1 ? (
                <span className="mt-auto hidden pt-2 text-zinc-300 sm:inline" aria-hidden="true">
                  →
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
