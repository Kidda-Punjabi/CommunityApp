"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelCohortSwitchRequest } from "@/app/dashboard/tutor/calendar-actions";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import type { CohortSwitchRequestRow } from "@/lib/calendar/types";
import { cn } from "@/lib/ui/styles";

type CancelCohortSwitchRequestControlProps = {
  request: Pick<
    CohortSwitchRequestRow,
    "id" | "toCohortName" | "toSessionStartsAt" | "toSessionEndsAt"
  >;
  className?: string;
  /** Compact single-line style for Learn cards. */
  compact?: boolean;
};

export function CancelCohortSwitchRequestControl({
  request,
  className,
  compact = false,
}: CancelCohortSwitchRequestControlProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const requestedWhen =
    request.toSessionStartsAt && request.toSessionEndsAt
      ? formatSessionWhen(request.toSessionStartsAt, request.toSessionEndsAt)
      : null;
  const requestedLabel = [request.toCohortName, requestedWhen].filter(Boolean).join(" · ");

  async function cancel() {
    setPending(true);
    setMessage(null);
    const result = await cancelCohortSwitchRequest(request.id);
    setPending(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage(result.success ?? "Request cancelled.");
    router.refresh();
  }

  return (
    <div className={cn("rounded-2xl bg-violet-50 px-3 py-2 text-sm text-violet-900", className)}>
      <p>
        Alternate cohort request pending
        {requestedLabel ? (
          <>
            {" "}
            for <span className="font-semibold">{requestedLabel}</span>
          </>
        ) : null}
        {compact ? "." : " — the Kidda team will respond soon."}
      </p>
      <p className={cn("text-xs text-violet-800/80", compact ? "mt-1" : "mt-1.5")}>
        Cancel before it&apos;s approved and it won&apos;t count toward your reschedule allowance.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => void cancel()}
        className="mt-1.5 font-semibold underline disabled:opacity-60"
      >
        {pending ? "Cancelling…" : "Cancel request"}
      </button>
      {message ? <span className="mt-1 block text-xs">{message}</span> : null}
    </div>
  );
}
