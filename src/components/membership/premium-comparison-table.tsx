import { Check, Minus } from "lucide-react";
import {
  FREE_GAME_UNLOCK_COUNT,
} from "@/lib/games/premium-gating";
import { FREE_KID_STORY_TASTE_COUNT } from "@/lib/kids/constants";
import {
  LIVE_TRANSLATE_FREE_MONTHLY_CAP_SECONDS,
  LIVE_TRANSLATE_PREMIUM_MONTHLY_CAP_SECONDS,
} from "@/lib/live-translate/config";
import {
  PHOTO_TRANSLATE_FREE_MONTHLY_CAP_SCANS,
  PHOTO_TRANSLATE_PREMIUM_MONTHLY_CAP_SCANS,
} from "@/lib/photo-translate/config";

const FREE_LIVE_MINUTES = LIVE_TRANSLATE_FREE_MONTHLY_CAP_SECONDS / 60;
const PREMIUM_LIVE_MINUTES = LIVE_TRANSLATE_PREMIUM_MONTHLY_CAP_SECONDS / 60;

export const PREMIUM_COMPARISON_ROWS = [
  {
    feature: "Everyday Punjabi topics",
    free: "Topics 1–3",
    premium: "All 24 topics",
  },
  {
    feature: "Games",
    free: `Starter set (${FREE_GAME_UNLOCK_COUNT} games)`,
    premium: "Full games catalogue",
  },
  {
    feature: "Photo Translate",
    free: `${PHOTO_TRANSLATE_FREE_MONTHLY_CAP_SCANS} scans/month`,
    premium: `${PHOTO_TRANSLATE_PREMIUM_MONTHLY_CAP_SCANS} scans/month`,
  },
  {
    feature: "Live Translate",
    free: `${FREE_LIVE_MINUTES} min/month`,
    premium: `${PREMIUM_LIVE_MINUTES} min/month`,
  },
  {
    feature: "Kids Mode bedtime stories",
    free: `${FREE_KID_STORY_TASTE_COUNT} stories`,
    premium: "All 30 stories",
  },
] as const;

export function PremiumComparisonTable() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-zinc-200 bg-zinc-50 px-3 py-3 sm:px-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Feature
        </p>
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Free
        </p>
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-violet-700">
          Premium
        </p>
      </div>
      <ul className="divide-y divide-zinc-100">
        {PREMIUM_COMPARISON_ROWS.map((row) => (
          <li
            key={row.feature}
            className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 px-3 py-3.5 sm:px-4"
          >
            <p className="text-sm font-medium text-zinc-900">{row.feature}</p>
            <div className="flex flex-col items-center gap-1 text-center">
              <Minus
                className="h-3.5 w-3.5 text-zinc-300 sm:hidden"
                aria-hidden
              />
              <p className="text-xs leading-snug text-zinc-500 sm:text-sm">
                {row.free}
              </p>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl bg-violet-50 px-2 py-2 text-center sm:px-3">
              <Check
                className="h-3.5 w-3.5 text-violet-600 sm:hidden"
                aria-hidden
              />
              <p className="text-xs font-semibold leading-snug text-violet-800 sm:text-sm">
                {row.premium}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
