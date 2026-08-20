"use client";

import {
  buildMonthWeeks,
  formatDayHeading,
  formatMonthLabel,
  toLocalDateKey,
  toLocalDateKeyFromDate,
  type MonthDayCell,
} from "@/lib/calendar/month-calendar";
import type { BookableSlot } from "@/lib/tutoring/availability/types";
import { cn, ui } from "@/lib/ui/styles";
import { useEffect, useMemo, useState } from "react";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type BookingSlotCalendarProps = {
  slots: BookableSlot[];
  /** Single-select mode (booking / admin). */
  selectedSlot?: BookableSlot | null;
  onSelectSlot?: (slot: BookableSlot) => void;
  onClearSlot?: () => void;
  /** Multi-select mode (reschedule preferred times). */
  selectedSlots?: BookableSlot[];
  onChangeSelectedSlots?: (slots: BookableSlot[]) => void;
  maxSelections?: number;
};

function formatTimeOnly(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const startLabel = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const endLabel = end.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${startLabel} – ${endLabel}`;
}

function slotKey(slot: BookableSlot): string {
  return `${slot.startsAt}|${slot.endsAt}`;
}

export function BookingSlotCalendar({
  slots,
  selectedSlot = null,
  onSelectSlot,
  onClearSlot,
  selectedSlots,
  onChangeSelectedSlots,
  maxSelections,
}: BookingSlotCalendarProps) {
  const multi = typeof maxSelections === "number" && maxSelections > 1;
  const selectedList = multi ? (selectedSlots ?? []) : selectedSlot ? [selectedSlot] : [];
  const selectedKeys = new Set(selectedList.map(slotKey));

  const slotsByDate = useMemo(() => {
    const map = new Map<string, BookableSlot[]>();
    for (const slot of slots) {
      const key = toLocalDateKey(slot.startsAt);
      const list = map.get(key) ?? [];
      list.push(slot);
      map.set(key, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    return map;
  }, [slots]);

  const availableDates = useMemo(
    () => [...slotsByDate.keys()].sort((a, b) => a.localeCompare(b)),
    [slotsByDate]
  );

  const firstAvailable = availableDates[0] ?? null;
  const firstAvailableDate = firstAvailable ? new Date(`${firstAvailable}T12:00:00`) : new Date();

  const [visibleYear, setVisibleYear] = useState(firstAvailableDate.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(firstAvailableDate.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(firstAvailable);

  useEffect(() => {
    if (availableDates.length === 0) {
      setSelectedDateKey(null);
      return;
    }
    setSelectedDateKey((current) =>
      current && slotsByDate.has(current) ? current : availableDates[0]!
    );
    const anchor = availableDates[0]!;
    const date = new Date(`${anchor}T12:00:00`);
    setVisibleYear(date.getFullYear());
    setVisibleMonth(date.getMonth());
  }, [availableDates, slotsByDate]);

  const weeks = useMemo(
    () => buildMonthWeeks(visibleYear, visibleMonth),
    [visibleYear, visibleMonth]
  );

  const daySlots = selectedDateKey ? (slotsByDate.get(selectedDateKey) ?? []) : [];
  const todayKey = toLocalDateKey(new Date().toISOString());

  const shiftMonth = (delta: number) => {
    const next = new Date(visibleYear, visibleMonth + delta, 1);
    setVisibleYear(next.getFullYear());
    setVisibleMonth(next.getMonth());
  };

  const handlePickSlot = (slot: BookableSlot) => {
    if (multi && onChangeSelectedSlots) {
      const key = slotKey(slot);
      const exists = selectedList.some((s) => slotKey(s) === key);
      if (exists) {
        onChangeSelectedSlots(selectedList.filter((s) => slotKey(s) !== key));
        return;
      }
      if (selectedList.length >= (maxSelections ?? 1)) return;
      onChangeSelectedSlots([...selectedList, slot]);
      return;
    }
    onSelectSlot?.(slot);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className={ui.btnGhost}
            aria-label="Previous month"
          >
            ←
          </button>
          <p className="font-heading text-sm font-semibold text-zinc-900">
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

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="py-1">
              {label}
            </div>
          ))}
        </div>

        <div className="mt-1 space-y-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((cell) => {
                const dateKey = toLocalDateKeyFromDate(cell.date);
                const hasSlots = (slotsByDate.get(dateKey)?.length ?? 0) > 0;
                return (
                  <DayCell
                    key={dateKey}
                    cell={cell}
                    dateKey={dateKey}
                    todayKey={todayKey}
                    selectedDateKey={selectedDateKey}
                    hasSlots={hasSlots}
                    onSelect={(key) => {
                      setSelectedDateKey(key);
                      if (
                        !multi &&
                        selectedSlot &&
                        toLocalDateKey(selectedSlot.startsAt) !== key
                      ) {
                        onClearSlot?.();
                      }
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selectedDateKey ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-900">
            {formatDayHeading(selectedDateKey)}
          </h3>
          {daySlots.length === 0 ? (
            <p className="text-sm text-zinc-500">No available times on this day.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {daySlots.map((slot) => {
                const isSelected = selectedKeys.has(slotKey(slot));
                const atMax = multi && !isSelected && selectedList.length >= (maxSelections ?? 1);
                return (
                  <button
                    key={slot.startsAt}
                    type="button"
                    disabled={atMax}
                    onClick={() => handlePickSlot(slot)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      isSelected
                        ? "border-violet-400 bg-violet-50 text-violet-900"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    )}
                  >
                    {formatTimeOnly(slot.startsAt, slot.endsAt)}
                    {isSelected && multi ? (
                      <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                        Preferred
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DayCell({
  cell,
  dateKey,
  todayKey,
  selectedDateKey,
  hasSlots,
  onSelect,
}: {
  cell: MonthDayCell;
  dateKey: string;
  todayKey: string;
  selectedDateKey: string | null;
  hasSlots: boolean;
  onSelect: (dateKey: string) => void;
}) {
  const isSelected = selectedDateKey === dateKey;
  const isToday = todayKey === dateKey;
  const muted = !cell.inMonth || !hasSlots;

  return (
    <button
      type="button"
      disabled={!hasSlots}
      onClick={() => onSelect(dateKey)}
      className={cn(
        "flex min-h-12 flex-col items-center justify-center rounded-2xl border px-1 py-1.5 text-sm transition-colors",
        muted
          ? "cursor-default border-transparent text-zinc-300"
          : "border-transparent text-zinc-900 hover:bg-violet-50",
        !muted && hasSlots ? "font-semibold" : null,
        isSelected && hasSlots ? "border-violet-300 bg-violet-50 text-violet-900" : null,
        isToday && !isSelected && hasSlots ? "ring-1 ring-violet-200" : null,
        !hasSlots ? "opacity-50" : null
      )}
    >
      <span>{cell.date.getDate()}</span>
      {hasSlots ? (
        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-500" />
      ) : (
        <span className="mt-1 h-1.5" />
      )}
    </button>
  );
}
