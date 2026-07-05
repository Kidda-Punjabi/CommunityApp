import { CatchupLucideIcon } from "@/lib/catchup/teaching-visuals/lucide-icon";
import type { PhraseShowcaseConfig } from "@/lib/catchup/teaching-visuals/types";

export function PhraseShowcaseVisual({ config }: { config: PhraseShowcaseConfig }) {
  return (
    <div className="aspect-video w-full rounded-2xl border border-violet-200 bg-violet-50/40 px-4 py-5">
      <div className="grid h-full grid-cols-2 content-center gap-3 sm:grid-cols-3">
        {config.items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className="flex flex-col items-center rounded-xl border border-white/80 bg-white/90 px-2 py-3 text-center shadow-sm"
          >
            <CatchupLucideIcon
              name={item.icon}
              className="h-8 w-8 text-violet-600 sm:h-9 sm:w-9"
            />
            <p className="mt-2 text-[11px] font-medium leading-snug text-zinc-700 sm:text-xs">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
