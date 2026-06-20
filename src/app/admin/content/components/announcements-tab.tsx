"use client";

import { useActionState } from "react";
import {
  publishAnnouncement,
  type ActionResult,
} from "@/app/dashboard/notifications/actions";

const initial: ActionResult = {};

export function AnnouncementsTab() {
  const [state, formAction, pending] = useActionState(publishAnnouncement, initial);

  return (
    <div className="max-w-lg rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-zinc-900">Send announcement</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Broadcasts to all members who have announcements enabled in notification settings.
      </p>

      <form action={formAction} className="mt-5 space-y-4">
        <div>
          <label htmlFor="announcement-title" className="block text-sm font-medium text-zinc-700">
            Title
          </label>
          <input
            id="announcement-title"
            name="title"
            required
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
          />
        </div>
        <div>
          <label htmlFor="announcement-body" className="block text-sm font-medium text-zinc-700">
            Message
          </label>
          <textarea
            id="announcement-body"
            name="body"
            required
            rows={5}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
          />
        </div>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.success && <p className="text-sm text-green-700">{state.success}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send to all members"}
        </button>
      </form>
    </div>
  );
}
