import { ChevronRight } from "lucide-react";
import { NavLink } from "@/components/ui/nav-link";
import { switchCohortPath, type SwitchCohortTrackId } from "@/lib/calendar/cohort-week-progress";
import { cn } from "@/lib/ui/styles";

export function SwitchCohortLink({
  trackId,
  href,
  variant = "link",
}: {
  trackId?: SwitchCohortTrackId;
  href?: string;
  variant?: "link" | "button";
}) {
  const to = href ?? (trackId ? switchCohortPath(trackId) : null);
  if (!to) return null;

  return (
    <p className="pt-4 text-center">
      <NavLink
        href={to}
        className={cn(
          "inline-flex items-center gap-0.5 text-sm font-medium text-zinc-500 hover:text-zinc-700",
          variant === "button" &&
            "rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1.5 hover:bg-zinc-200"
        )}
      >
        Can no longer make this cohort?
        <ChevronRight className="h-4 w-4" aria-hidden />
      </NavLink>
    </p>
  );
}
