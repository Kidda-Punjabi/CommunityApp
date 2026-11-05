import { ChevronRight } from "lucide-react";
import { NavLink } from "@/components/ui/nav-link";
import { cn } from "@/lib/ui/styles";

export type GamesCategoryCard = {
  id: "vocab" | "grammar" | "group" | "battle";
  title: string;
  href: string;
  wide: boolean;
};

const ART: Record<GamesCategoryCard["id"], { back: string; backFill: string; front: string; frontFill: string }> = {
  vocab: {
    back: "M20 12h60a12 12 0 0 1 12 12v40a12 12 0 0 1-12 12H48L28 94V76h-8A12 12 0 0 1 8 64V24a12 12 0 0 1 12-12z",
    backFill: "#F59E0B",
    front: "M28 32h44a5 5 0 0 1 0 10H28a5 5 0 0 1 0-10zM28 50h28a5 5 0 0 1 0 10H28a5 5 0 0 1 0-10z",
    frontFill: "#FDE68A",
  },
  grammar: {
    back: "M37 6h26a6 6 0 0 1 6 6v26a6 6 0 0 1-6 6H37a6 6 0 0 1-6-6V12a6 6 0 0 1 6-6zM11 52h26a6 6 0 0 1 6 6v26a6 6 0 0 1-6 6H11a6 6 0 0 1-6-6V58a6 6 0 0 1 6-6zM63 52h26a6 6 0 0 1 6 6v26a6 6 0 0 1-6 6H63a6 6 0 0 1-6-6V58a6 6 0 0 1 6-6z",
    backFill: "#10B981",
    front: "M44 15h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H44a3 3 0 0 1-3-3V18a3 3 0 0 1 3-3zM18 61h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3V64a3 3 0 0 1 3-3zM70 61h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H70a3 3 0 0 1-3-3V64a3 3 0 0 1 3-3z",
    frontFill: "#A7F3D0",
  },
  group: {
    back: "M22 26a11 11 0 1 1 0 22 11 11 0 0 1 0-22zM78 26a11 11 0 1 1 0 22 11 11 0 0 1 0-22zM4 84c0-14 8-24 18-24 6 0 11 3 14 8-6 6-9 14-9 22H8a4 4 0 0 1-4-4zM96 84c0-14-8-24-18-24-6 0-11 3-14 8 6 6 9 14 9 22h19a4 4 0 0 0 4-4z",
    backFill: "#A78BFA",
    front: "M50 14a15 15 0 1 1 0 30 15 15 0 0 1 0-30zM24 88c0-18 12-32 26-32s26 14 26 32a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4z",
    frontFill: "#6D28D9",
  },
  battle: {
    back: "M50 4c12 8 24 11 36 12 2 0 4 2 4 4v28c0 22-16 38-40 48C26 86 10 70 10 48V20c0-2 2-4 4-4 12-1 24-4 36-12z",
    backFill: "#DC4A06",
    front: "M55 22 33 54h14l-4 24 24-34H52z",
    frontFill: "#FFA91F",
  },
};

/** Games tab: one big picture per category, in the same flat style as the streak flame. */
export function GamesCategoryCards({ cards }: { cards: GamesCategoryCard[] }) {
  return (
    <div className="grid min-h-[540px] flex-1 auto-rows-fr grid-cols-2 gap-2.5 lg:max-h-[760px]">
      {cards.map((card) => {
        const art = ART[card.id];
        return (
          <NavLink
            key={card.id}
            href={card.href}
            className={cn("relative block overflow-hidden rounded-3xl bg-[#F3EEFF] text-zinc-900", card.wide && "col-span-2")}
          >
            <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-50">
              <circle cx="16" cy="20" r="3" fill={art.backFill} />
              <circle cx="86" cy="30" r="2" fill={art.backFill} />
              <circle cx="28" cy="46" r="1.6" fill={art.backFill} />
              <circle cx="72" cy="12" r="1.6" fill={art.backFill} />
            </svg>
            <svg
              aria-hidden="true"
              viewBox="0 0 100 100"
              className={cn("absolute bottom-[22px] left-1/2 -translate-x-1/2", card.wide ? "h-[168px] w-[168px]" : "h-[138px] w-[138px]")}
            >
              <path d={art.back} fill={art.backFill} />
              <path d={art.front} fill={art.frontFill} />
            </svg>
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-white px-3.5 py-2.5">
              <span className="min-w-0 flex-1 font-heading text-lg font-extrabold leading-tight">{card.title}</span>
              <ChevronRight className="h-[18px] w-[18px] shrink-0 text-zinc-500" aria-hidden />
            </span>
          </NavLink>
        );
      })}
    </div>
  );
}
