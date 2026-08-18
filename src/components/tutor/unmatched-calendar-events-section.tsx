"use client";

import {
  clearCalendarSessionClassification,
  excludeCalendarSession,
  tagCalendarSession,
} from "@/app/dashboard/tutor/calendar-actions";
import {
  KIDDA_WORK_CATEGORIES,
  KIDDA_WORK_CATEGORY_LABELS,
  type KiddaWorkCategory,
} from "@/lib/calendar/event-tags";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import type { TutorSelfCalendarSession } from "@/lib/calendar/load-tutor-self-calendar";
import { cn, ui } from "@/lib/ui/styles";
import { useState } from "react";

type Classification = "personal" | KiddaWorkCategory;

function sessionClassification(session: TutorSelfCalendarSession): Classification | null {
  if (session.kiddaTag) return session.kiddaTag;
  if (session.excludedByTutor) return "personal";
  return null;
}

export function UnmatchedCalendarEventsSection({
  sessions,
}: {
  sessions: TutorSelfCalendarSession[];
}) {
  const unmatched = sessions.filter(
    (session) =>
      session.matchMethod === "unmatched" && new Date(session.starts_at) >= new Date()
  );

  if (unmatched.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className={ui.sectionTitle}>Unmatched events</h2>
        <p className="text-xs text-zinc-500">
          Personal or Kidda work — not both. Untagged events are not counted in hours. Tagging
          replaces a personal mark, and marking personal removes a Kidda tag.
        </p>
      </div>
      <ul className="space-y-3">
        {unmatched.map((session) => (
          <UnmatchedEventCard key={session.id} session={session} />
        ))}
      </ul>
    </section>
  );
}

function UnmatchedEventCard({ session }: { session: TutorSelfCalendarSession }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [wholeSeries, setWholeSeries] = useState(
    session.kiddaTagScope === "series" ||
      (session.excludedByTutor && Boolean(session.googleRecurringEventId))
  );
  const current = sessionClassification(session);
  const canSeries = Boolean(session.googleRecurringEventId);
  const scope: "event" | "series" = canSeries && wholeSeries ? "series" : "event";

  const run = async (action: () => Promise<{ error?: string; success?: string }>) => {
    setPending(true);
    setMessage(null);
    const result = await action();
    setMessage(result.success ?? result.error ?? null);
    setPending(false);
    if (result.success) window.location.reload();
  };

  return (
    <li className={ui.cardBordered}>
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
        {current === "personal"
          ? "Personal"
          : current
            ? KIDDA_WORK_CATEGORY_LABELS[current]
            : "Not counted"}
      </p>
      <p className="font-semibold text-zinc-900">{session.title}</p>
      <p className="mt-1 text-sm text-zinc-500">
        {formatSessionWhen(session.starts_at, session.ends_at)}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <ClassificationButton
          label="Personal"
          active={current === "personal"}
          disabled={pending}
          onClick={() => void run(() => excludeCalendarSession(session.id, scope))}
        />
        {KIDDA_WORK_CATEGORIES.map((category) => (
          <ClassificationButton
            key={category}
            label={KIDDA_WORK_CATEGORY_LABELS[category]}
            active={current === category}
            disabled={pending}
            onClick={() => void run(() => tagCalendarSession(session.id, category, scope))}
          />
        ))}
        {current ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void run(() => clearCalendarSessionClassification(session.id))}
            className={ui.btnGhost}
          >
            Clear
          </button>
        ) : null}
      </div>

      {canSeries ? (
        <label className="mt-3 flex items-center gap-2 text-xs text-zinc-600">
          <input
            type="checkbox"
            checked={wholeSeries}
            onChange={(event) => setWholeSeries(event.target.checked)}
            disabled={pending}
          />
          Apply to the whole recurring series
        </label>
      ) : null}

      {message ? <p className="mt-2 text-xs text-zinc-500">{message}</p> : null}
    </li>
  );
}

function ClassificationButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(active ? ui.pillActive : ui.pillInactive, "disabled:opacity-60")}
    >
      {label}
    </button>
  );
}
