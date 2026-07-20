import { normalizeCalendarDateFromIso } from "@/lib/admin/package-schedule";

type NotionDateValue = {
  start?: string;
  end?: string | null;
  time_zone?: string | null;
  is_datetime?: boolean | number | null;
};

export type ParsedNotionStartDate = {
  /** Course / calendar start (date at noon UTC). */
  calendarStartIso: string | null;
  weeklySessionStartIso: string | null;
  weeklySessionEndIso: string | null;
  weeklySessionHasTime: boolean;
};

function notionStartDateValue(
  rawProperties: Record<string, unknown>
): NotionDateValue | null {
  const prop = rawProperties["Start Date"] as { date?: NotionDateValue | null } | undefined;
  return prop?.date ?? null;
}

export function readNotionStartDateDetails(
  rawProperties: Record<string, unknown>
): ParsedNotionStartDate {
  const date = notionStartDateValue(rawProperties);
  if (!date?.start?.trim()) {
    return {
      calendarStartIso: null,
      weeklySessionStartIso: null,
      weeklySessionEndIso: null,
      weeklySessionHasTime: false,
    };
  }

  const start = date.start.trim();
  const calendarStartIso = normalizeCalendarDateFromIso(start);

  const isDatetimeFlag = date.is_datetime;
  const weeklySessionHasTime =
    isDatetimeFlag === true ||
    isDatetimeFlag === 1 ||
    (isDatetimeFlag == null && start.includes("T"));

  if (!weeklySessionHasTime) {
    return {
      calendarStartIso,
      weeklySessionStartIso: null,
      weeklySessionEndIso: null,
      weeklySessionHasTime: false,
    };
  }

  return {
    calendarStartIso,
    weeklySessionStartIso: start,
    weeklySessionEndIso: date.end?.trim() || null,
    weeklySessionHasTime: true,
  };
}
