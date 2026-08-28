"use client";

import { useState } from "react";
import { formatYourWeekClassLabel } from "@/lib/calendar/cohort-switch-candidates";
import { NO_MATCHING_ALTERNATE_SESSION_COPY } from "@/lib/calendar/constants";
import type { StudentScheduledSession } from "@/lib/calendar/types";
import { cn, ui } from "@/lib/ui/styles";

export function SessionSwitchEmptyState({
  session,
  className,
}: {
  session?: StudentScheduledSession | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const weekLabel = session ? formatYourWeekClassLabel(session) : null;

  if (!open) {
    return (
      <div className={className}>
        <button type="button" onClick={() => setOpen(true)} className={ui.btnPrimary}>
          Switch this session
        </button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 border-t border-zinc-100 pt-3", className)}>
      {weekLabel ? (
        <p className="text-sm font-medium text-zinc-800">
          {weekLabel}
          {session?.cohortName ? ` · ${session.cohortName}` : ""}
        </p>
      ) : null}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
        <p className="text-sm font-medium text-zinc-900">{NO_MATCHING_ALTERNATE_SESSION_COPY}</p>
      </div>
      <button type="button" onClick={() => setOpen(false)} className={ui.btnGhost}>
        Close
      </button>
    </div>
  );
}
