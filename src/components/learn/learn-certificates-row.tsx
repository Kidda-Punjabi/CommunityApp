import { NavLink } from "@/components/ui/nav-link";
import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";
import { Award } from "lucide-react";

/** Course-stack row for Certificates — same shape as LearnCourseRow (active). */
export function LearnCertificatesRow() {
  return (
    <NavLink
      href="/dashboard/learn/certificates"
      className={cn(
        pressableClass,
        "block rounded-3xl bg-[#F5F3FF] p-4 shadow-[0_2px_16px_-4px_rgba(24,24,27,0.08)] hover:opacity-95"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#7C3AED]/15 text-[#6D28D9]">
          <Award className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-base font-semibold leading-snug text-[#2E1065]">
            Certificates
          </p>
          <p className="mt-1 text-xs font-medium text-[#5B21B6]/80">
            View your awards
          </p>
        </div>
      </div>
    </NavLink>
  );
}
