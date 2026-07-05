"use client";

import { useActionState, useEffect, useState } from "react";
import {
  reportForumContent,
  type ForumActionResult,
} from "@/app/dashboard/community/forum/actions";

const initial: ForumActionResult = {};

type ForumReportDialogProps = {
  targetType: "post" | "reply";
  targetId: string;
  label?: string;
};

export function ForumReportDialog({
  targetType,
  targetId,
  label = "Report",
}: ForumReportDialogProps) {
  const [open, setOpen] = useState(false);
  const boundAction = reportForumContent.bind(null, targetType, targetId);
  const [state, formAction, pending] = useActionState(boundAction, initial);

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-zinc-500 hover:text-red-600"
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-labelledby="report-title"
          >
            <h2 id="report-title" className="text-lg font-semibold text-zinc-900">
              Report {targetType}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Tell us what is wrong. Reports are reviewed by tutors and community staff.
            </p>

            <form action={formAction} className="mt-4 space-y-4">
              <textarea
                name="reason"
                required
                rows={4}
                placeholder="Describe the issue…"
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />

              {state.error && (
                <p className="text-sm text-red-600" role="alert">
                  {state.error}
                </p>
              )}
              {state.success && (
                <p className="text-sm text-emerald-600" role="status">
                  {state.success}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                >
                  {pending ? "Sending…" : "Submit report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
