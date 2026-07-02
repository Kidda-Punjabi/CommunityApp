"use client";

import { formatTimeRange, toLocalDateKeyFromDate } from "@/lib/calendar/month-calendar";
import {
  formatDayColumnHeader,
  formatHourLabel,
  formatRangeLabel,
  getCurrentTimeIndicator,
  getEventColor,
  getGridHeightPx,
  getHourSlots,
  getWeekDays,
  HOUR_HEIGHT_PX,
  layoutDayEvents,
  shiftAnchorDate,
  startOfWeekMonday,
  WEEKDAY_LABELS,
  type LayoutedEvent,
  type TimeGridSession,
} from "@/lib/calendar/time-grid-calendar";
import { cn, ui } from "@/lib/ui/styles";
import { useEffect, useMemo, useState } from "react";

const TIME_GUTTER_WIDTH = "3.5rem";
const DAY_MIN_WIDTH = "8.5rem";

type TimeGridCalendarProps = {
  sessions: TimeGridSession[];
  mode: "day" | "week";
  emptyLabel?: string;
};

export function TimeGridCalendar({
  sessions,
  mode,
  emptyLabel = "No lessons in this period.",
}: TimeGridCalendarProps) {
  const [anchorDate, setAnchorDate] = useState(() => startOfWeekMonday(new Date()));

  useEffect(() => {
    if (mode === "week") {
      setAnchorDate((current) => startOfWeekMonday(current));
    }
  }, [mode]);

  const visibleDays = useMemo(() => {
    if (mode === "day") {
      const day = new Date(anchorDate);
      day.setHours(0, 0, 0, 0);
      return [day];
    }
    return getWeekDays(anchorDate);
  }, [anchorDate, mode]);

  const hourSlots = useMemo(() => getHourSlots(), []);
  const gridHeight = getGridHeightPx();

  const eventsByDay = useMemo(() => {
    const map = new Map<string, LayoutedEvent[]>();
    for (const day of visibleDays) {
      const key = toLocalDateKeyFromDate(day);
      map.set(key, layoutDayEvents(sessions, key));
    }
    return map;
  }, [sessions, visibleDays]);

  const hasVisibleEvents = [...eventsByDay.values()].some((events) => events.length > 0);

  const goToday = () => {
    setAnchorDate(mode === "week" ? startOfWeekMonday(new Date()) : new Date());
  };
  const goPrev = () => setAnchorDate((current) => shiftAnchorDate(current, mode, -1));
  const goNext = () => setAnchorDate((current) => shiftAnchorDate(current, mode, 1));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={goToday} className={ui.btnSecondary}>
            Today
          </button>
          <button type="button" onClick={goPrev} className={ui.btnGhost} aria-label="Previous">
            ←
          </button>
          <button type="button" onClick={goNext} className={ui.btnGhost} aria-label="Next">
            →
          </button>
        </div>
        <p className="font-heading text-base font-semibold text-zinc-900">
          {formatRangeLabel(anchorDate, mode)}
        </p>
      </div>

      <div className={`${ui.cardBordered} overflow-hidden p-0`}>
        <div className="overflow-x-auto">
          <div
            className="min-w-full"
            style={{
              minWidth:
                mode === "week"
                  ? `calc(${TIME_GUTTER_WIDTH} + 7 * ${DAY_MIN_WIDTH})`
                  : undefined,
            }}
          >
            {mode === "week" ? (
              <div
                className="grid border-b border-zinc-200 bg-zinc-50"
                style={{
                  gridTemplateColumns: `${TIME_GUTTER_WIDTH} repeat(7, minmax(${DAY_MIN_WIDTH}, 1fr))`,
                }}
              >
                <div className="border-r border-zinc-200" />
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="border-r border-zinc-200 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 last:border-r-0"
                  >
                    {label}
                  </div>
                ))}
              </div>
            ) : null}

            <div
              className="grid border-b border-zinc-200 bg-zinc-50"
              style={{
                gridTemplateColumns:
                  mode === "week"
                    ? `${TIME_GUTTER_WIDTH} repeat(7, minmax(${DAY_MIN_WIDTH}, 1fr))`
                    : `${TIME_GUTTER_WIDTH} minmax(0, 1fr)`,
              }}
            >
              <div className="border-r border-zinc-200" />
              {visibleDays.map((day) => {
                const header = formatDayColumnHeader(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "border-r border-zinc-200 px-2 py-3 text-center last:border-r-0",
                      header.isToday && "bg-violet-50"
                    )}
                  >
                    {mode === "day" ? (
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        {header.weekday}
                      </p>
                    ) : null}
                    <p
                      className={cn(
                        "inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                        mode === "day" ? "mt-0.5" : null,
                        header.isToday ? "bg-violet-600 text-white" : "text-zinc-900"
                      )}
                    >
                      {header.day}
                    </p>
                  </div>
                );
              })}
            </div>

            <div
              className="grid overflow-y-auto"
              style={{
                maxHeight: "min(70vh, 840px)",
                gridTemplateColumns:
                  mode === "week"
                    ? `${TIME_GUTTER_WIDTH} repeat(7, minmax(${DAY_MIN_WIDTH}, 1fr))`
                    : `${TIME_GUTTER_WIDTH} minmax(0, 1fr)`,
              }}
            >
              <div className="relative border-r border-zinc-200 bg-white" style={{ height: gridHeight }}>
                {hourSlots.map((hour, index) => (
                  <div
                    key={hour}
                    className="absolute right-2 -translate-y-1/2 text-right text-[11px] font-medium text-zinc-400"
                    style={{ top: index * HOUR_HEIGHT_PX }}
                  >
                    {index === 0 ? null : formatHourLabel(hour)}
                  </div>
                ))}
              </div>

              {visibleDays.map((day) => {
                const dayKey = toLocalDateKeyFromDate(day);
                const events = eventsByDay.get(dayKey) ?? [];
                const nowIndicator = getCurrentTimeIndicator(dayKey);
                const header = formatDayColumnHeader(day);

                return (
                  <div
                    key={dayKey}
                    className={cn(
                      "relative border-r border-zinc-200 bg-white last:border-r-0",
                      header.isToday && "bg-violet-50/30"
                    )}
                    style={{ height: gridHeight }}
                  >
                    {hourSlots.map((hour, index) => (
                      <div
                        key={hour}
                        className="absolute inset-x-0 border-t border-zinc-100"
                        style={{ top: index * HOUR_HEIGHT_PX }}
                      />
                    ))}

                    {nowIndicator.visible ? (
                      <div
                        className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                        style={{ top: nowIndicator.top }}
                      >
                        <span className="h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-rose-500" />
                        <span className="h-0.5 flex-1 bg-rose-500" />
                      </div>
                    ) : null}

                    {events.map((event) => (
                      <TimeGridEventBlock key={event.session.id} event={event} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {!hasVisibleEvents ? <p className="text-sm text-zinc-500">{emptyLabel}</p> : null}
    </div>
  );
}

function TimeGridEventBlock({ event }: { event: LayoutedEvent }) {
  const color = getEventColor(event.session.colorIndex ?? 0);
  const widthPercent = 100 / event.columnCount;
  const leftPercent = (event.column / event.columnCount) * 100;
  const timeLabel = formatTimeRange(event.session.starts_at, event.session.ends_at);
  const isCompact = event.height < 44;
  const isPersonal = event.session.personal;
  const inviteeDot = event.session.inviteeDot;

  const content = (
    <div
      className={cn(
        "absolute z-10 overflow-hidden rounded-md border-l-4 px-1.5 py-1 shadow-sm",
        color.bg,
        color.border,
        color.text,
        isPersonal && "opacity-45 saturate-[0.65]",
        event.session.meet_link && "cursor-pointer hover:brightness-95"
      )}
      style={{
        top: event.top,
        height: event.height,
        left: `calc(${leftPercent}% + 2px)`,
        width: `calc(${widthPercent}% - 4px)`,
      }}
      title={`${event.session.title} · ${timeLabel}`}
    >
      <p
        className={cn(
          "flex min-w-0 items-center gap-1 truncate font-semibold leading-tight",
          isCompact ? "text-[11px]" : "text-xs"
        )}
      >
        {inviteeDot ? (
          <span
            className={cn(
              "inline-block h-2 w-2 shrink-0 rounded-full",
              inviteeDot === "red" ? "bg-rose-500" : "bg-amber-400"
            )}
            aria-hidden
          />
        ) : null}
        <span className="truncate">{event.session.title}</span>
      </p>
      {!isCompact ? (
        <>
          <p className="truncate text-[11px] opacity-80">{timeLabel}</p>
          {event.session.subtitle ? (
            <p className="truncate text-[11px] opacity-70">{event.session.subtitle}</p>
          ) : null}
          {event.session.detail ? (
            <p className="truncate text-[11px] opacity-70">{event.session.detail}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );

  if (event.session.meet_link) {
    return (
      <a href={event.session.meet_link} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return content;
}
