"use client";

import { useActionState, useState } from "react";
import {
  publishAnnouncement,
  type ActionResult,
} from "@/app/dashboard/notifications/actions";
import type { AdminMemberOption } from "@/app/admin/content/actions";
import { AnnouncementMemberPicker } from "./announcement-member-picker";

const initial: ActionResult = {};

type AudienceMode = "all" | "selected";

export function AnnouncementsTab() {
  const [state, formAction, pending] = useActionState(publishAnnouncement, initial);
  const [audience, setAudience] = useState<AudienceMode>("all");
  const [selectedMembers, setSelectedMembers] = useState<AdminMemberOption[]>([]);

  const submitLabel =
    audience === "all"
      ? pending
        ? "Sending…"
        : "Send to all members"
      : pending
        ? "Sending…"
        : selectedMembers.length > 0
          ? `Send to ${selectedMembers.length} member${selectedMembers.length === 1 ? "" : "s"}`
          : "Send to selected members";

  return (
    <div className="max-w-lg rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-zinc-900">Send announcement</h2>
      <p className="mt-1 text-sm text-zinc-500">
        In-app notification for members who have announcements enabled.
      </p>

      <form action={formAction} className="mt-5 space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-700">Audience</legend>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
            <input
              type="radio"
              name="audience"
              value="all"
              checked={audience === "all"}
              onChange={() => setAudience("all")}
            />
            All members
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
            <input
              type="radio"
              name="audience"
              value="selected"
              checked={audience === "selected"}
              onChange={() => setAudience("selected")}
            />
            Selected members
          </label>
        </fieldset>

        {audience === "selected" && (
          <AnnouncementMemberPicker
            selected={selectedMembers}
            onChange={setSelectedMembers}
          />
        )}

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
          disabled={pending || (audience === "selected" && selectedMembers.length === 0)}
          className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </form>
    </div>
  );
}
