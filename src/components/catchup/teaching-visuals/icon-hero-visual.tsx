import { CatchupLucideIcon } from "@/lib/catchup/teaching-visuals/lucide-icon";
import { accentStyle } from "@/lib/catchup/teaching-visuals/colors";
import type { IconHeroConfig } from "@/lib/catchup/teaching-visuals/types";

export function IconHeroVisual({ config }: { config: IconHeroConfig }) {
  const style = accentStyle(config.accentColor);

  return (
    <div
      className={`flex aspect-video w-full flex-col items-center justify-center rounded-2xl border px-6 py-8 text-center ${style.surface} ${style.border}`}
    >
      <div className="flex items-center justify-center gap-4">
        {config.icons.map((icon) => (
          <CatchupLucideIcon
            key={icon}
            name={icon}
            className={`h-14 w-14 sm:h-16 sm:w-16 ${style.icon}`}
          />
        ))}
      </div>
      <p className={`mt-5 max-w-md text-lg font-semibold leading-snug ${style.text}`}>
        {config.label}
      </p>
    </div>
  );
}
