import { ChevronRight } from "lucide-react";
import { NavLink } from "@/components/ui/nav-link";
import { switchCohortPath, type SwitchCohortTrackId } from "@/lib/calendar/cohort-week-progress";

export function SwitchCohortLink({ trackId }: { trackId: SwitchCohortTrackId }) {
  return (
    <p className="pt-4 text-center">
      <NavLink
        href={switchCohortPath(trackId)}
        className="inline-flex items-center gap-0.5 text-sm font-medium text-zinc-500 hover:text-zinc-700"
      >
        Can no longer make this cohort?
        <ChevronRight className="h-4 w-4" aria-hidden />
      </NavLink>
    </p>
  );
}
