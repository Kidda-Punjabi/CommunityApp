import { COMMUNITY_WEEK_EPOCH } from "@/lib/community/constants";

function localDateParts(instant: Date, timeZone: string): { y: number; m: number; d: number } {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  const [y, m, d] = formatted.split("-").map(Number);
  return { y, m, d };
}

function mondayUtc(y: number, m: number, d: number): number {
  const utc = Date.UTC(y, m - 1, d);
  const day = new Date(utc).getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return utc + offset * 86_400_000;
}

/** Week 1 is the week of 28 September 2026. The same calendar week shares a topic in every region. */
export function communityWeekNumber(startsAt: Date, timeZone: string): number {
  const local = localDateParts(startsAt, timeZone);
  const monday = mondayUtc(local.y, local.m, local.d);
  const [ey, em, ed] = COMMUNITY_WEEK_EPOCH.split("-").map(Number);
  const epoch = Date.UTC(ey, em - 1, ed);
  const weeks = Math.round((monday - epoch) / (7 * 86_400_000));
  return (((weeks % 24) + 24) % 24) + 1;
}
