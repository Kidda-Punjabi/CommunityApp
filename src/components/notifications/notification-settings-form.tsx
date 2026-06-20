"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  updateNotificationSettings,
  type ActionResult,
} from "@/app/dashboard/notifications/actions";
import type { NotificationSettings } from "@/lib/notifications/load-notifications";
import { ui } from "@/lib/ui/styles";

const initial: ActionResult = {};

type NotificationSettingsFormProps = {
  settings: NotificationSettings;
};

export function NotificationSettingsForm({ settings }: NotificationSettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateNotificationSettings, initial);

  return (
    <div className={`${ui.page} ${ui.stackLoose}`}>
      <div>
        <Link href="/dashboard/profile" className="text-sm font-medium text-violet-600">
          ← Profile
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-zinc-900">Notification settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Choose what you want to hear about in the app.</p>
      </div>

      <form action={formAction} className={ui.card}>
        <ul className="space-y-4">
          <SettingRow
            name="friend_requests"
            label="Friend requests"
            description="When someone sends you a friend request"
            defaultChecked={settings.friendRequests}
          />
          <SettingRow
            name="friend_level_ups"
            label="Friends leveling up"
            description="When a friend passes a level-up test"
            defaultChecked={settings.friendLevelUps}
          />
          <SettingRow
            name="kudos"
            label="Kudos"
            description="When a friend sends you kudos for leveling up"
            defaultChecked={settings.kudos}
          />
          <SettingRow
            name="announcements"
            label="Announcements"
            description="News and updates from the Kidda team"
            defaultChecked={settings.announcements}
          />
          <SettingRow
            name="game_challenges"
            label="Game challenges"
            description="When a friend challenges you to beat their score"
            defaultChecked={settings.gameChallenges}
          />
        </ul>

        {state.error && <p className="mt-4 text-sm text-red-600">{state.error}</p>}
        {state.success && <p className="mt-4 text-sm text-green-700">{state.success}</p>}

        <button
          type="submit"
          disabled={pending}
          className={`mt-5 ${ui.btnPrimaryBlock}`}
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
      </form>
    </div>
  );
}

function SettingRow({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <input
        id={name}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
      />
      <label htmlFor={name} className="flex-1 cursor-pointer">
        <p className="text-sm font-medium text-zinc-900">{label}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </label>
    </li>
  );
}
