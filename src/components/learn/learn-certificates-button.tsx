import { NavLink } from "@/components/ui/nav-link";
import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";
import { Award } from "lucide-react";

export function LearnCertificatesButton() {
  return (
    <NavLink
      href="/dashboard/learn/certificates"
      aria-label="Certificates"
      className={cn(
        pressableClass,
        "flex h-10 w-10 items-center justify-center rounded-full bg-white text-violet-700 shadow-[0_2px_10px_-2px_rgba(124,58,237,0.35)] ring-1 ring-violet-100 hover:bg-violet-50"
      )}
    >
      <Award className="h-5 w-5" aria-hidden />
    </NavLink>
  );
}
