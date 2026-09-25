import { NavLink } from "@/components/ui/nav-link";
import type { AdultClassCard as AdultClassCardData } from "@/lib/learning/load-adult-class-cards";
import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";

export function AdultClassCard({ card }: { card: AdultClassCardData }) {
  return (
    <div className="rounded-3xl bg-[#EDE9FE] p-4 shadow-[0_2px_16px_-4px_rgba(24,24,27,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#5B21B6]/80">Your class</p>
      <p className="mt-1 font-heading text-base font-semibold leading-snug text-[#2E1065]">
        {card.courseName}
      </p>
      {card.weekLesson ? (
        <p className="mt-1 text-xs font-medium text-[#5B21B6]/80">{card.weekLesson}</p>
      ) : null}
      {card.nextClass ? (
        <p className="mt-0.5 text-xs font-medium text-[#5B21B6]/80">Next class {card.nextClass}</p>
      ) : null}
      <NavLink
        href={card.href}
        className={cn(
          pressableClass,
          "mt-3 inline-flex items-center justify-center rounded-full bg-[#7C3AED] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6D28D9]"
        )}
      >
        Open course
      </NavLink>
    </div>
  );
}
