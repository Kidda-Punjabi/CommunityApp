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
        "flex items-center gap-3 rounded-2xl bg-zinc-100 px-3.5 py-3.5 text-zinc-600 shadow-[0_1px_8px_-4px_rgba(24,24,27,0.06)] hover:bg-zinc-50"
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-200/80 text-zinc-500">
        <ClipboardList className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-sm font-semibold text-zinc-700">
          Check how your kids are doing
        </span>
        <span className="mt-0.5 block text-[11px] font-medium text-zinc-500">
          Homework, attendance, and tutor notes
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
    </NavLink>
  );
}
