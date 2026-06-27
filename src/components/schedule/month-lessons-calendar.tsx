"use client";

import {
  buildMonthWeeks,
  formatDayHeading,
  formatMonthLabel,
  formatTimeRange,
  groupSessionsByDate,
  toLocalDateKey,
  toLocalDateKeyFromDate,
  type MonthDayCell,
} from "@/lib/calendar/month-calendar";
import { cn, ui } from "@/lib/ui/styles";
import { useMemo, useState } from "react";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type MonthCalendarSession = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  meet_link?: string | null;
  subtitle?: string | null;
};

type MonthLessonsCalendarProps = {
  sessions: MonthCalendarSession[];
  emptySelectionLabel?: string;
};

export function MonthLessonsCalendar({
  sessions,
  emptySelectionLabel = "Select a day to see lessons.",
}: MonthLessonsCalendarProps) {
  const todayKey = toLocalDateKey(new Date().toISOString());
  const initial = sessions[0] ? new Date(sessions[0].starts_at) : new Date();
  const [visibleYear, setVisibleYear] = useState(initial.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(initial.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(
    sessions[0] ? toLocalDateKey(sessions[0].starts_at) : todayKey
  );

  const sessionsByDate = useMemo(() => groupSessionsByDate(sessions), [sessions]);
  const weeks = useMemo(
    () => buildMonthWeeks(visibleYear, visibleMonth),
    [visibleYear, visibleMonth]
  );

  const selectedSessions = selectedDateKey ? (sessionsByDate.get(selectedDateKey) ?? []) : [];

  const shiftMonth = (delta: number) => {
    const next = new Date(visibleYear, visibleMonth + delta, 1);
    setVisibleYear(next.getFullYear());
    setVisibleMonth(next.getMonth());
  };

  return (
    <div className="space-y-4">
      <div className={`${ui.cardBordered} p-4`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className={ui.btnGhost}
            aria-label="Previous month"
          >
            ←
          </button>
          <p className="font-heading text-base font-semibold text-zinc-900">
            {formatMonthLabel(visibleYear, visibleMonth)}
          </p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className={ui.btnGhost}
            aria-label="Next month"
          >
            →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="py-1">
              {label}
            </div>
          ))}
        </div>

        <div className="mt-1 space-y-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((cell) => (
                <CalendarDayButton
                  key={cell.date.toISOString()}
                  cell={cell}
                  todayKey={todayKey}
                  selectedDateKey={selectedDateKey}
                  lessonCount={
                    sessionsByDate.get(toLocalDateKeyFromDate(cell.date))?.length ?? 0
                  }
                  onSelect={setSelectedDateKey}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {selectedDateKey ? (
          <h3 className="text-sm font-semibold text-zinc-900">
            {formatDayHeading(selectedDateKey)}
          </h3>
        ) : null}

        {selectedSessions.length === 0 ? (
          <p className="text-sm text-zinc-500">{emptySelectionLabel}</p>
        ) : (
          <ul className="space-y-2">
            {selectedSessions.map((session) => (
              <li key={session.id} className={`${ui.cardBordered} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {session.subtitle ? (
                      <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                        {session.subtitle}
                      </p>
                    ) : null}
                    <p className="font-semibold text-zinc-900">{session.title}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {formatTimeRange(session.starts_at, session.ends_at)}
                    </p>
                  </div>
                  {session.meet_link ? (
                    <a
                      href={session.meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={ui.btnPrimary}
                    >
                      Join
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CalendarDayButton({
  cell,
  todayKey,
  selectedDateKey,
  lessonCount,
  onSelect,
}: {
  cell: MonthDayCell;
  todayKey: string;
  selectedDateKey: string | null;
  lessonCount: number;
  onSelect: (dateKey: string) => void;
}) {
  const dateKey = toLocalDateKeyFromDate(cell.date);
  const isSelected = selectedDateKey === dateKey;
  const isToday = todayKey === dateKey;

  return (
    <button
      type="button"
      onClick={() => onSelect(dateKey)}
      className={cn(
        "flex min-h-14 flex-col items-center justify-center rounded-2xl border px-1 py-2 text-sm transition-colors",
        cell.inMonth ? "border-transparent text-zinc-900" : "border-transparent text-zinc-300",
        isSelected ? "border-violet-300 bg-violet-50" : "hover:bg-zinc-50",
        isToday && !isSelected ? "ring-1 ring-violet-200" : null
      )}
    >
      <span className="font-medium">{cell.date.getDate()}</span>
      {lessonCount > 0 ? (
        <span className="mt-1 flex gap-0.5">
          {Array.from({ length: Math.min(lessonCount, 3) }).map((_, index) => (
            <span key={index} className="h-1.5 w-1.5 rounded-full bg-violet-500" />
          ))}
        </span>
      ) : (
        <span className="mt-1 h-1.5" />
      )}
    </button>
  );
}
