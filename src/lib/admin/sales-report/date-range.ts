import {
  formatLondonYmd,
  londonCivilToUtc,
} from "@/lib/admin/acquisition/date-range";
import { UK_DISPLAY_TIMEZONE, weekdayNameInTimezone } from "@/lib/calendar/uk-display-time";
import type { SalesReportPreset, SalesReportRange } from "@/lib/admin/sales-report/types";

const WEEKDAY_OFFSET: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
};

export function addLondonDays(ymd: string, days: number): string {
  const date = londonCivilToUtc(ymd, 12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return formatLondonYmd(date);
}

export function londonMondayOf(ymd: string): string {
  const noon = londonCivilToUtc(ymd, 12, 0, 0, 0);
  const weekday = weekdayNameInTimezone(noon.toISOString(), UK_DISPLAY_TIMEZONE);
  const offset = WEEKDAY_OFFSET[weekday] ?? 0;
  return addLondonDays(ymd, -offset);
}

export function ymdInInclusiveRange(
  ymd: string | null | undefined,
  startYmd: string,
  endYmd: string
): boolean {
  if (!ymd) return false;
  const day = ymd.slice(0, 10);
  return day >= startYmd && day <= endYmd;
}

export function notionDateToYmd(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function daysInclusive(startYmd: string, endYmd: string): number {
  const start = londonCivilToUtc(startYmd, 12, 0, 0, 0).getTime();
  const end = londonCivilToUtc(endYmd, 12, 0, 0, 0).getTime();
  return Math.round((end - start) / 86_400_000) + 1;
}

function formatRangeLabel(startYmd: string, endYmd: string): string {
  const start = londonCivilToUtc(startYmd, 12, 0, 0, 0);
  const end = londonCivilToUtc(endYmd, 12, 0, 0, 0);
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: UK_DISPLAY_TIMEZONE,
  };
  return `${start.toLocaleDateString("en-GB", opts)} to ${end.toLocaleDateString("en-GB", opts)}`;
}

function previousEquivalent(
  startYmd: string,
  endYmd: string,
  preset: SalesReportPreset
): { startYmd: string; endYmd: string } {
  if (preset === "this_week" || preset === "last_week") {
    const days = daysInclusive(startYmd, endYmd);
    const prevEnd = addLondonDays(startYmd, -1);
    const prevStart = addLondonDays(prevEnd, -(days - 1));
    return { startYmd: prevStart, endYmd: prevEnd };
  }

  if (preset === "this_month") {
    const startMonth = startYmd.slice(0, 7);
    const [year, month] = startMonth.split("-").map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevStart = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
    const day = Number(endYmd.slice(8, 10));
    const lastDayPrev = lastDayOfLondonMonth(prevYear, prevMonth);
    const prevEndDay = Math.min(day, lastDayPrev);
    return {
      startYmd: prevStart,
      endYmd: `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(prevEndDay).padStart(2, "0")}`,
    };
  }

  if (preset === "last_month") {
    const [year, month] = startYmd.slice(0, 7).split("-").map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const lastDay = lastDayOfLondonMonth(prevYear, prevMonth);
    return {
      startYmd: `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`,
      endYmd: `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  const days = daysInclusive(startYmd, endYmd);
  const prevEnd = addLondonDays(startYmd, -1);
  return { startYmd: addLondonDays(prevEnd, -(days - 1)), endYmd: prevEnd };
}

function lastDayOfLondonMonth(year: number, month: number): number {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const firstNext = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return Number(addLondonDays(firstNext, -1).slice(8, 10));
}

export function resolveSalesReportRange(
  preset: SalesReportPreset,
  now = new Date(),
  custom?: { from: string; to: string }
): SalesReportRange {
  const todayYmd = formatLondonYmd(now);
  const year = Number(todayYmd.slice(0, 4));
  const month = Number(todayYmd.slice(5, 7));

  let startYmd: string;
  let endYmd: string;
  let resolved: SalesReportPreset = preset;

  if (preset === "custom" && custom?.from && custom?.to && custom.from <= custom.to) {
    startYmd = custom.from;
    endYmd = custom.to;
  } else if (preset === "this_week") {
    startYmd = londonMondayOf(todayYmd);
    endYmd = addLondonDays(startYmd, 6);
  } else if (preset === "last_week") {
    const thisMonday = londonMondayOf(todayYmd);
    startYmd = addLondonDays(thisMonday, -7);
    endYmd = addLondonDays(startYmd, 6);
  } else if (preset === "this_month") {
    startYmd = `${year}-${String(month).padStart(2, "0")}-01`;
    endYmd = todayYmd;
  } else if (preset === "last_month") {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const lastDay = lastDayOfLondonMonth(prevYear, prevMonth);
    startYmd = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
    endYmd = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  } else {
    startYmd = londonMondayOf(todayYmd);
    endYmd = addLondonDays(startYmd, 6);
    resolved = "this_week";
  }

  const previous = previousEquivalent(startYmd, endYmd, resolved);
  const mtdStartYmd = `${year}-${String(month).padStart(2, "0")}-01`;

  return {
    preset: resolved,
    startYmd,
    endYmd,
    previousStartYmd: previous.startYmd,
    previousEndYmd: previous.endYmd,
    mtdStartYmd,
    mtdEndYmd: todayYmd,
    label: formatRangeLabel(startYmd, endYmd),
    previousLabel: formatRangeLabel(previous.startYmd, previous.endYmd),
    mtdLabel: formatRangeLabel(mtdStartYmd, todayYmd),
  };
}

export function minFetchStartYmd(range: SalesReportRange): string {
  return [range.startYmd, range.previousStartYmd, range.mtdStartYmd].sort()[0];
}

export function maxFetchEndYmd(range: SalesReportRange): string {
  return [range.endYmd, range.previousEndYmd, range.mtdEndYmd].sort()[2];
}
