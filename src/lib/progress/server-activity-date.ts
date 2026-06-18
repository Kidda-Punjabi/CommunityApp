import { cookies } from "next/headers";
import {
  ACTIVITY_DATE_COOKIE,
  TIMEZONE_OFFSET_COOKIE,
  getLocalActivityDate,
  getLocalActivityDateForOffset,
  isValidActivityDate,
} from "@/lib/progress/activity-date";

export async function getUserActivityDate(): Promise<string> {
  const store = await cookies();

  const offsetRaw = store.get(TIMEZONE_OFFSET_COOKIE)?.value;
  if (offsetRaw != null && offsetRaw !== "") {
    const offset = Number.parseInt(offsetRaw, 10);
    if (!Number.isNaN(offset)) {
      return getLocalActivityDateForOffset(offset);
    }
  }

  const fromCookie = store.get(ACTIVITY_DATE_COOKIE)?.value;
  if (isValidActivityDate(fromCookie)) {
    return fromCookie;
  }

  return getLocalActivityDate();
}

export async function hasTrustedUserActivityDate(): Promise<boolean> {
  const store = await cookies();
  const offsetRaw = store.get(TIMEZONE_OFFSET_COOKIE)?.value;
  if (offsetRaw != null && offsetRaw !== "") {
    const offset = Number.parseInt(offsetRaw, 10);
    if (!Number.isNaN(offset)) return true;
  }

  return isValidActivityDate(store.get(ACTIVITY_DATE_COOKIE)?.value);
}
