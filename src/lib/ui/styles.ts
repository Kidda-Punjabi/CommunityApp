/** Shared Kidda UI class tokens — update here to restyle the whole app. */
import { pressableClass } from "@/lib/ui/pressable";

export { pressableClass };

export const ui = {
  pageBg: "bg-zinc-50",
  /** Space for fixed bottom nav + home-indicator safe area */
  navClearance: "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]",
  page: "flex min-h-0 flex-1 flex-col px-5 py-7",
  section: "mb-8",
  sectionTitle: "mb-4 font-heading text-lg font-semibold text-zinc-900",
  stack: "space-y-4",
  stackLoose: "space-y-5",

  card: "rounded-3xl bg-white p-5 shadow-[0_4px_24px_-6px_rgba(24,24,27,0.08)]",
  cardBordered:
    "rounded-3xl border border-zinc-200/60 bg-white p-5 shadow-[0_4px_24px_-6px_rgba(24,24,27,0.06)]",
  cardInteractive:
    `${pressableClass} block rounded-3xl border border-zinc-200/60 bg-white p-5 shadow-[0_4px_24px_-6px_rgba(24,24,27,0.06)] transition-all hover:border-violet-200 hover:shadow-[0_6px_28px_-6px_rgba(124,58,237,0.12)]`,
  statCard: "rounded-3xl bg-white p-4 shadow-[0_2px_16px_-4px_rgba(24,24,27,0.07)]",

  heroCard:
    `${pressableClass} relative block overflow-hidden rounded-3xl bg-violet-600 p-6 shadow-[0_8px_32px_-8px_rgba(124,58,237,0.45)] transition-colors hover:bg-violet-500`,
  heroBadge:
    "inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-sm",
  heroTitle: "mt-3 font-heading text-xl font-bold text-white",
  heroSubtitle: "mt-1 text-sm text-violet-100",
  heroCta:
    "mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-violet-600",

  btnPrimary:
    `${pressableClass} inline-flex items-center justify-center rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_-4px_rgba(124,58,237,0.5)] transition-colors hover:bg-violet-500`,
  btnPrimaryBlock:
    `${pressableClass} flex w-full items-center justify-center rounded-full bg-violet-600 px-6 py-3.5 text-center text-sm font-semibold text-white shadow-[0_4px_14px_-4px_rgba(124,58,237,0.5)] transition-colors hover:bg-violet-500`,
  btnSecondary:
    `${pressableClass} inline-flex items-center justify-center rounded-full border border-zinc-200/80 bg-white px-6 py-3 text-sm font-semibold text-violet-600 transition-colors hover:bg-violet-50`,
  btnGhost:
    `${pressableClass} inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-violet-600 transition-colors hover:bg-violet-50`,
  btnIcon:
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-[0_2px_10px_-2px_rgba(124,58,237,0.4)] transition-colors group-hover:bg-violet-500",

  input:
    "block w-full rounded-full border border-zinc-200 bg-white px-5 py-3 text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20",

  pillActive: "rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white",
  pillInactive:
    "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50",

  listRow:
    `${pressableClass} flex items-center gap-4 rounded-3xl bg-white p-4 shadow-[0_2px_16px_-4px_rgba(24,24,27,0.07)] transition-all hover:shadow-[0_4px_22px_-4px_rgba(24,24,27,0.1)]`,
  listRowIcon:
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-2xl",

  emptyState:
    "flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-white/80 px-6 py-14 text-center",
} as const;

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
