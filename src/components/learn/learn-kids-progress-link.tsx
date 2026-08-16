import { NavLink } from "@/components/ui/nav-link";
import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";
import { ChevronRight, ClipboardList } from "lucide-react";

export function LearnKidsProgressLink() {
  return (
    <NavLink
      href="/dashboard/learn/kids-progress"
      className={cn(
        pressableClass,
        "flex items-center gap-3 rounded-2xl bg-emerald-100 px-3.5 py-3.5 text-emerald-950 shadow-[0_1px_8px_-4px_rgba(16,185,129,0.18)] hover:bg-emerald-50"
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-700">
        <ClipboardList className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-sm font-semibold text-emerald-950">
          Check how your kids are doing
        </span>
        <span className="mt-0.5 block text-[11px] font-medium text-emerald-800/80">
          Homework, attendance, and tutor notes
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
    </NavLink>
  );
}
