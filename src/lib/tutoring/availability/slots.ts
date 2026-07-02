import { startOfWeekMonday } from "@/lib/calendar/time-grid-calendar";
import type { BookableSlot, TutorAvailabilitySettings, TutorAvailabilityWindow } from "./types";

type BusyBlock = { startsAt: string; endsAt: string };

function parseTimeOnDate(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const copy = new Date(date);
  copy.setHours(hours, minutes, 0, 0);
  return copy;
}

function weekdayMondayFirst(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function expandBusyWithBuffers(
  blocks: BusyBlock[],
  bufferMinutes: number
): Array<{ start: number; end: number }> {
  const bufferMs = bufferMinutes * 60 * 1000;
  return blocks.map((block) => ({
    start: new Date(block.startsAt).getTime() - bufferMs,
    end: new Date(block.endsAt).getTime() + bufferMs,
  }));
}

function formatSlotLabel(start: Date, end: Date): string {
  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeLabel = `${start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  return `${dateLabel} · ${timeLabel}`;
}

export function generateBookableSlots(
  settings: TutorAvailabilitySettings,
  windows: TutorAvailabilityWindow[],
  busyBlocks: BusyBlock[],
  options?: { fromMs?: number; daysAhead?: number }
): BookableSlot[] {
  const fromMs = options?.fromMs ?? Date.now();
  const daysAhead = options?.daysAhead ?? 28;
  const earliestBookable = fromMs + settings.bookingBufferHours * 60 * 60 * 1000;
  const sessionMs = settings.defaultSessionMinutes * 60 * 1000;
  const busyWithBuffers = expandBusyWithBuffers(busyBlocks, settings.bufferBetweenSessionsMinutes);

  const windowsByDay = new Map<number, TutorAvailabilityWindow[]>();
  for (const window of windows) {
    const list = windowsByDay.get(window.dayOfWeek) ?? [];
    list.push(window);
    windowsByDay.set(window.dayOfWeek, list);
  }

  const slots: BookableSlot[] = [];
  const cursor = new Date(fromMs);
  cursor.setHours(0, 0, 0, 0);

  for (let day = 0; day < daysAhead; day += 1) {
    const date = new Date(cursor);
    date.setDate(cursor.getDate() + day);
    const dayWindows = windowsByDay.get(weekdayMondayFirst(date)) ?? [];

    for (const window of dayWindows) {
      let slotStart = parseTimeOnDate(date, window.startTime);
      const windowEnd = parseTimeOnDate(date, window.endTime);

      while (slotStart.getTime() + sessionMs <= windowEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + sessionMs);

        if (slotStart.getTime() >= earliestBookable) {
          const startMs = slotStart.getTime();
          const endMs = slotEnd.getTime();
          const blocked = busyWithBuffers.some((busy) =>
            overlaps(startMs, endMs, busy.start, busy.end)
          );

          if (!blocked) {
            slots.push({
              startsAt: slotStart.toISOString(),
              endsAt: slotEnd.toISOString(),
              label: formatSlotLabel(slotStart, slotEnd),
            });
          }
        }

        slotStart = new Date(slotStart.getTime() + sessionMs);
      }
    }
  }

  return slots;
}

export function getDefaultWeeklyWindows(): Array<{
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  enabled: boolean;
}> {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    startTime: dayOfWeek <= 4 ? "09:00" : "",
    endTime: dayOfWeek <= 4 ? "17:00" : "",
    enabled: dayOfWeek <= 4,
  }));
}

export { startOfWeekMonday };
