import type { ReactNode } from "react";
import { NavLink } from "@/components/ui/nav-link";
import { ui } from "@/lib/ui/styles";

type GroupCohortOpensPanelProps = {
  title: string;
  message: string;
  /** Optional package / staff section still shown while content is gated. */
  staffSection?: ReactNode;
};

export function GroupCohortOpensPanel({
  title,
  message,
  staffSection,
}: GroupCohortOpensPanelProps) {
  return (
    <div className={ui.page}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
      </div>

      <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-4 text-sm text-violet-900">
        <p className="font-semibold">{message}</p>
        <p className="mt-1 text-violet-800">
          Your place is confirmed — lesson content unlocks on your cohort start date.
        </p>
      </div>

      {staffSection ? <div className="mt-6">{staffSection}</div> : null}

      <div className="mt-6">
        <NavLink href="/dashboard/schedule" className={ui.btnSecondary}>
          View schedule
        </NavLink>
      </div>
    </div>
  );
}
