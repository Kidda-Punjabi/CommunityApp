"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { countActivePushDevices } from "@/app/admin/push-log/actions";
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
  const [deviceCount, setDeviceCount] = useState<number | null>(null);

  useEffect(() => {
    void countActivePushDevices().then(setDeviceCount).catch(() => setDeviceCount(null));
  }, []);

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
        In-app notification for members who have announcements enabled.{" "}
        <Link href="/admin/push-log" className="font-medium text-violet-700">
          Push log
        </Link>
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
        <label className="flex items-start gap-2 text-sm text-zinc-700">
          <input type="checkbox" name="send_push" className="mt-1" />
          <span>
            Send as push notification
            <span className="mt-0.5 block text-xs text-zinc-500">
              Off by default.
              {deviceCount == null
                ? ""
                : ` This will reach ${deviceCount} active device${deviceCount === 1 ? "" : "s"}.`}
            </span>
          </span>
        </label>
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
