import { UK_DISPLAY_TIMEZONE } from "@/lib/calendar/uk-display-time";
import type { AcquisitionRangeId } from "@/lib/admin/acquisition/types";

export type ResolvedAcquisitionRange = {
  id: AcquisitionRangeId;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  label: string;
};

function londonParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_DISPLAY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

export function formatLondonYmd(date: Date): string {
  const { year, month, day } = londonParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Convert a London civil clock time to a UTC Date. */
export function londonCivilToUtc(
  ymd: string,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0
): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  let utc = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  for (let i = 0; i < 4; i += 1) {
    const parts = londonParts(new Date(utc));
    const got = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const want = Date.UTC(year, month - 1, day, hour, minute, second);
    const delta = want - got;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc + ms);
}

function addLondonDays(ymd: string, days: number): string {
  const date = londonCivilToUtc(ymd, 12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return formatLondonYmd(date);
}

function currentQuarterStartYmd(todayYmd: string): string {
  const month = Number(todayYmd.slice(5, 7));
  const year = todayYmd.slice(0, 4);
  const quarterMonth = month <= 3 ? "01" : month <= 6 ? "04" : month <= 9 ? "07" : "10";
  return `${year}-${quarterMonth}-01`;
}

export function resolveAcquisitionRange(
  id: AcquisitionRangeId,
  now = new Date(),
  custom?: { from: string; to: string }
): ResolvedAcquisitionRange {
  const todayYmd = formatLondonYmd(now);

  let startYmd: string;
  let endYmd: string;
  let label: string;

  if (id === "custom" && custom?.from && custom?.to && custom.from <= custom.to) {
    startYmd = custom.from;
    endYmd = custom.to;
    label = `${custom.from} – ${custom.to}`;
  } else if (id === "7d") {
    startYmd = addLondonDays(todayYmd, -6);
    endYmd = todayYmd;
    label = "Last 7 days";
  } else if (id === "quarter") {
    startYmd = currentQuarterStartYmd(todayYmd);
    endYmd = todayYmd;
    label = "This quarter";
  } else {
    startYmd = addLondonDays(todayYmd, -29);
    endYmd = todayYmd;
    label = "Last 30 days";
  }

  const start = londonCivilToUtc(startYmd, 0, 0, 0, 0);
  const end = londonCivilToUtc(endYmd, 23, 59, 59, 999);
  const durationMs = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);

  return {
    id: id === "custom" && !(custom?.from && custom?.to) ? "30d" : id,
    start,
    end,
    previousStart,
    previousEnd,
    label,
  };
}

export function inRange(iso: string | null | undefined, start: Date, end: Date): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;
  return time >= start.getTime() && time <= end.getTime();
}
