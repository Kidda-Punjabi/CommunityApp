"use client";

import {
  saveTutorAvailabilitySettings,
  saveTutorAvailabilityWindows,
  type AvailabilityActionResult,
} from "@/app/dashboard/tutor/availability-actions";
import type { TutorCapacitySummary } from "@/lib/tutoring/availability/types";
import { WEEKDAY_LABELS } from "@/lib/tutoring/availability/types";
import type { TutorAvailabilitySettings, TutorAvailabilityWindow } from "@/lib/tutoring/availability/types";
import { formatHours } from "@/lib/tutoring/availability/capacity";
import { cn, ui } from "@/lib/ui/styles";
import { useActionState } from "react";

const initial: AvailabilityActionResult = {};

type TutorAvailabilitySectionProps = {
  settings: TutorAvailabilitySettings;
  windows: TutorAvailabilityWindow[];
  capacity: TutorCapacitySummary;
  schemaReady: boolean;
};

function dayWindow(
  windows: TutorAvailabilityWindow[],
  dayOfWeek: number
): { startTime: string; endTime: string; enabled: boolean } {
  const window = windows.find((row) => row.dayOfWeek === dayOfWeek);
  return {
    enabled: Boolean(window),
    startTime: window?.startTime ?? "09:00",
    endTime: window?.endTime ?? "17:00",
  };
}

export function TutorAvailabilitySection({
  settings,
  windows,
  capacity,
  schemaReady,
}: TutorAvailabilitySectionProps) {
  const [settingsState, settingsAction, settingsPending] = useActionState(
    saveTutorAvailabilitySettings,
    initial
  );
  const [windowsState, windowsAction, windowsPending] = useActionState(
    saveTutorAvailabilityWindows,
    initial
  );

  if (!schemaReady) {
    return (
      <section className={`${ui.cardBordered} space-y-2 p-4`}>
        <h2 className={ui.sectionTitle}>Hours & capacity</h2>
        <p className="text-sm text-zinc-600">
          Run <code className="text-xs">supabase/tutor-availability-and-bookings.sql</code> in the
          Supabase SQL Editor to enable capacity tracking and member booking.
        </p>
      </section>
    );
  }

  const utilizationTone =
    capacity.utilizationPercent >= 90
      ? "bg-rose-500"
      : capacity.utilizationPercent >= 70
        ? "bg-amber-400"
        : "bg-emerald-500";

  return (
    <section className="space-y-6">
      <div className={`${ui.cardBordered} space-y-4 p-4`}>
        <div>
          <h2 className={ui.sectionTitle}>Capacity this week</h2>
          <p className="text-xs text-zinc-500">{capacity.weekLabel}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600">
              {formatHours(capacity.usedHours)} used of {formatHours(capacity.weeklyCapacityHours)}
            </span>
            <span className="font-semibold text-zinc-900">{capacity.utilizationPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className={cn("h-full rounded-full transition-all", utilizationTone)}
              style={{ width: `${capacity.utilizationPercent}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            Counts synced calendar events (lessons and other kid-related work). Personal events
            marked &quot;not a lesson&quot; are excluded.
          </p>
        </div>
      </div>

      <form action={settingsAction} className={`${ui.cardBordered} space-y-4 p-4`}>
        <h2 className={ui.sectionTitle}>Capacity & booking rules</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Weekly capacity (hours)</span>
            <input
              type="number"
              name="weekly_capacity_hours"
              min={1}
              max={168}
              step={0.5}
              defaultValue={settings.weeklyCapacityHours}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Default session length (minutes)</span>
            <input
              type="number"
              name="default_session_minutes"
              min={15}
              max={240}
              step={15}
              defaultValue={settings.defaultSessionMinutes}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Booking buffer (hours)</span>
            <input
              type="number"
              name="booking_buffer_hours"
              min={0}
              max={168}
              step={1}
              defaultValue={settings.bookingBufferHours}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
            />
            <span className="mt-1 block text-xs text-zinc-500">
              Members cannot book within this many hours (e.g. 24 = no same-day).
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Gap between sessions (minutes)</span>
            <input
              type="number"
              name="buffer_between_sessions_minutes"
              min={0}
              max={120}
              step={5}
              defaultValue={settings.bufferBetweenSessionsMinutes}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
            />
          </label>
        </div>

        <input type="hidden" name="timezone" value={settings.timezone} />

        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <input
            type="checkbox"
            name="one_to_one_booking_enabled"
            defaultChecked={settings.oneToOneBookingEnabled}
            className="rounded border-zinc-300"
          />
          Allow members to book 1-to-1 slots from my available hours
        </label>

        {settingsState.error ? <p className="text-sm text-rose-600">{settingsState.error}</p> : null}
        {settingsState.success ? (
          <p className="text-sm text-emerald-700">{settingsState.success}</p>
        ) : null}

        <button type="submit" disabled={settingsPending} className={ui.btnPrimary}>
          {settingsPending ? "Saving…" : "Save capacity settings"}
        </button>
      </form>

      <form action={windowsAction} className={`${ui.cardBordered} space-y-4 p-4`}>
        <div>
          <h2 className={ui.sectionTitle}>Available hours for booking</h2>
          <p className="text-sm text-zinc-500">
            When members can request a 1-to-1. Existing calendar events block these slots
            automatically.
          </p>
        </div>

        <ul className="space-y-3">
          {WEEKDAY_LABELS.map((label, dayOfWeek) => {
            const row = dayWindow(windows, dayOfWeek);
            return (
              <li key={label} className="flex flex-wrap items-center gap-3">
                <label className="inline-flex w-24 items-center gap-2 text-sm font-medium text-zinc-700">
                  <input
                    type="checkbox"
                    name={`day_${dayOfWeek}_enabled`}
                    defaultChecked={row.enabled}
                    className="rounded border-zinc-300"
                  />
                  {label}
                </label>
                <input
                  type="time"
                  name={`day_${dayOfWeek}_start`}
                  defaultValue={row.startTime}
                  className="rounded-xl border border-zinc-200 px-2 py-1.5 text-sm"
                />
                <span className="text-zinc-400">to</span>
                <input
                  type="time"
                  name={`day_${dayOfWeek}_end`}
                  defaultValue={row.endTime}
                  className="rounded-xl border border-zinc-200 px-2 py-1.5 text-sm"
                />
              </li>
            );
          })}
        </ul>

        {windowsState.error ? <p className="text-sm text-rose-600">{windowsState.error}</p> : null}
        {windowsState.success ? (
          <p className="text-sm text-emerald-700">{windowsState.success}</p>
        ) : null}

        <button type="submit" disabled={windowsPending} className={ui.btnSecondary}>
          {windowsPending ? "Saving…" : "Save working hours"}
        </button>
      </form>
    </section>
  );
}
