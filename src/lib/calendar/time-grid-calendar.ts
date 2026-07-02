import { toLocalDateKey, toLocalDateKeyFromDate } from "@/lib/calendar/month-calendar";

export const GRID_START_HOUR = 6;
export const GRID_END_HOUR = 24;
export const HOUR_HEIGHT_PX = 56;

export type TimeGridSession = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  meet_link?: string | null;
  subtitle?: string | null;
  detail?: string | null;
  colorIndex?: number;
  personal?: boolean;
  inviteeDot?: "red" | "yellow" | null;
};

export type LayoutedEvent<T extends TimeGridSession = TimeGridSession> = {
  session: T;
  top: number;
  height: number;
  column: number;
  columnCount: number;
};

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function weekdayLabelMondayFirst(date: Date): string {
  const day = date.getDay();
  return WEEKDAY_LABELS[day === 0 ? 6 : day - 1];
}

export function startOfWeekMonday(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function getWeekDays(anchor: Date): Date[] {
  const start = startOfWeekMonday(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function shiftAnchorDate(anchor: Date, mode: "day" | "week", delta: number): Date {
  if (mode === "week") {
    return addDays(startOfWeekMonday(anchor), delta * 7);
  }
  return addDays(anchor, delta);
}

export function formatHourLabel(hour: number): string {
  const date = new Date(2000, 0, 1, hour, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric" });
}

export function formatDayColumnHeader(date: Date): { weekday: string; day: string; isToday: boolean } {
  const todayKey = toLocalDateKeyFromDate(new Date());
  const dateKey = toLocalDateKeyFromDate(date);
  return {
    weekday: weekdayLabelMondayFirst(date),
    day: String(date.getDate()),
    isToday: dateKey === todayKey,
  };
}

export function formatRangeLabel(anchor: Date, mode: "day" | "week"): string {
  if (mode === "day") {
    return anchor.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const days = getWeekDays(anchor);
  const start = days[0];
  const end = days[6];
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();

  const startLabel = start.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: sameMonth ? undefined : "short",
  });
  const endLabel = end.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  });

  if (sameYear) {
    return `${startLabel} – ${endLabel}, ${end.getFullYear()}`;
  }

  return `${start.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} – ${end.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
}

export function getHourSlots(): number[] {
  const slots: number[] = [];
  for (let hour = GRID_START_HOUR; hour < GRID_END_HOUR; hour += 1) {
    slots.push(hour);
  }
  return slots;
}

export function getGridHeightPx(): number {
  return (GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT_PX;
}

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function layoutDayEvents<T extends TimeGridSession>(
  sessions: T[],
  dayKey: string
): LayoutedEvent<T>[] {
  const gridStartMinutes = GRID_START_HOUR * 60;
  const gridEndMinutes = GRID_END_HOUR * 60;
  const pixelsPerMinute = HOUR_HEIGHT_PX / 60;

  const daySessions = sessions
    .filter((session) => toLocalDateKey(session.starts_at) === dayKey)
    .map((session) => {
      const start = new Date(session.starts_at);
      const end = new Date(session.ends_at);
      const startMinutes = minutesFromMidnight(start);
      const endMinutes = Math.max(startMinutes + 15, minutesFromMidnight(end));
      const clampedStart = clamp(startMinutes, gridStartMinutes, gridEndMinutes);
      const clampedEnd = clamp(endMinutes, gridStartMinutes, gridEndMinutes);

      return {
        session,
        startMinutes: clampedStart,
        endMinutes: clampedEnd,
        top: (clampedStart - gridStartMinutes) * pixelsPerMinute,
        height: Math.max((clampedEnd - clampedStart) * pixelsPerMinute, 24),
      };
    })
    .filter((item) => item.endMinutes > item.startMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);

  const layouted: LayoutedEvent<T>[] = [];
  let cluster: typeof daySessions = [];
  let clusterEnd = -1;

  const flushCluster = () => {
    if (cluster.length === 0) return;

    const columns: { endMinutes: number }[] = [];
    const placements: Array<{ item: (typeof daySessions)[number]; column: number }> = [];

    for (const item of cluster) {
      let columnIndex = columns.findIndex((column) => column.endMinutes <= item.startMinutes);
      if (columnIndex === -1) {
        columnIndex = columns.length;
        columns.push({ endMinutes: item.endMinutes });
      } else {
        columns[columnIndex].endMinutes = item.endMinutes;
      }
      placements.push({ item, column: columnIndex });
    }

    const columnCount = columns.length;
    for (const placement of placements) {
      layouted.push({
        session: placement.item.session,
        top: placement.item.top,
        height: placement.item.height,
        column: placement.column,
        columnCount,
      });
    }

    cluster = [];
    clusterEnd = -1;
  };

  for (const item of daySessions) {
    if (cluster.length === 0) {
      cluster = [item];
      clusterEnd = item.endMinutes;
      continue;
    }

    if (item.startMinutes < clusterEnd) {
      cluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMinutes);
    } else {
      flushCluster();
      cluster = [item];
      clusterEnd = item.endMinutes;
    }
  }

  flushCluster();
  return layouted;
}

export function getCurrentTimeIndicator(dayKey: string): { top: number; visible: boolean } {
  const now = new Date();
  if (toLocalDateKeyFromDate(now) !== dayKey) {
    return { top: 0, visible: false };
  }

  const minutes = minutesFromMidnight(now);
  const gridStartMinutes = GRID_START_HOUR * 60;
  const gridEndMinutes = GRID_END_HOUR * 60;

  if (minutes < gridStartMinutes || minutes > gridEndMinutes) {
    return { top: 0, visible: false };
  }

  const pixelsPerMinute = HOUR_HEIGHT_PX / 60;
  return {
    top: (minutes - gridStartMinutes) * pixelsPerMinute,
    visible: true,
  };
}

export const EVENT_COLOR_PALETTE = [
  { bg: "bg-blue-100", border: "border-blue-500", text: "text-blue-950", dot: "bg-blue-500" },
  { bg: "bg-violet-100", border: "border-violet-500", text: "text-violet-950", dot: "bg-violet-500" },
  { bg: "bg-emerald-100", border: "border-emerald-500", text: "text-emerald-950", dot: "bg-emerald-500" },
  { bg: "bg-amber-100", border: "border-amber-500", text: "text-amber-950", dot: "bg-amber-500" },
  { bg: "bg-rose-100", border: "border-rose-500", text: "text-rose-950", dot: "bg-rose-500" },
  { bg: "bg-cyan-100", border: "border-cyan-500", text: "text-cyan-950", dot: "bg-cyan-500" },
  { bg: "bg-fuchsia-100", border: "border-fuchsia-500", text: "text-fuchsia-950", dot: "bg-fuchsia-500" },
  { bg: "bg-lime-100", border: "border-lime-500", text: "text-lime-950", dot: "bg-lime-500" },
] as const;

export function getEventColor(index = 0) {
  return EVENT_COLOR_PALETTE[Math.abs(index) % EVENT_COLOR_PALETTE.length];
}
