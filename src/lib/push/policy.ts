/** Delivery rules for Kidda push. Pure functions so quiet hours and the daily cap can be tested without APNs. */

export const QUIET_START_HOUR = 21;
export const QUIET_END_HOUR = 8;
export const DAILY_NON_CLASS_CAP = 3;

/** C2 and C3 may send during quiet hours. Admin test pushes may too. */
export const QUIET_HOURS_ALLOWED = new Set(["C2", "C3", "test"]);

/** C1–C5 and homework feedback do not count toward the daily cap. */
export const CAP_EXEMPT = new Set(["C1", "C2", "C3", "C4", "C5", "H4", "test"]);

/** Never send forum, social, or community-session pushes about a kid profile. */
export const KID_BLOCKED_TYPES = new Set([
  "F1",
  "F2",
  "F3",
  "G1",
  "G2",
  "G3",
  "G4",
  "M1",
  "M2",
  "M3",
]);

const TERMINAL_LOG_STATUSES = new Set(["sent", "dropped", "failed", "skipped"]);

export type PushCategory =
  | "class_reminders"
  | "lesson_scheduling"
  | "homework_due"
  | "homework_reviews"
  | "community_sessions"
  | "forum_activity"
  | "streaks"
  | "weekly_recap"
  | "friend_requests"
  | "game_challenges"
  | "announcements"
  | "always";

export const TYPE_CATEGORY: Record<string, PushCategory> = {
  C1: "class_reminders",
  C2: "class_reminders",
  C3: "class_reminders",
  C4: "lesson_scheduling",
  C5: "lesson_scheduling",
  C6: "class_reminders",
  H1: "homework_due",
  H2: "homework_due",
  H3: "homework_due",
  H4: "homework_reviews",
  M1: "community_sessions",
  M2: "community_sessions",
  M3: "community_sessions",
  F1: "forum_activity",
  F2: "forum_activity",
  F3: "forum_activity",
  S1: "streaks",
  S2: "streaks",
  S3: "streaks",
  S4: "weekly_recap",
  R1: "lesson_scheduling",
  R2: "lesson_scheduling",
  R3: "always",
  G1: "friend_requests",
  G2: "friend_requests",
  G3: "game_challenges",
  G4: "game_challenges",
  A1: "announcements",
  test: "always",
};

export type DeliveryPlan =
  | { action: "send" }
  | { action: "skip"; reason: string }
  | { action: "defer"; notBefore: Date; reason: string }
  | { action: "drop"; reason: string };

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
};

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour: Number(read("hour")),
    minute: Number(read("minute")),
    weekday: read("weekday"),
  };
}

function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
  return asUtc - date.getTime();
}

/** UTC instant for a wall-clock time in `timeZone`. */
export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = zoneOffsetMs(new Date(utcGuess), timeZone);
  let utc = utcGuess - offset;
  const offset2 = zoneOffsetMs(new Date(utc), timeZone);
  if (offset2 !== offset) utc = utcGuess - offset2;
  return new Date(utc);
}

export function localDateKey(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function isQuietHours(date: Date, timeZone: string): boolean {
  const hour = zonedParts(date, timeZone).hour;
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

export function nextLocalMorning(date: Date, timeZone: string): Date {
  const parts = zonedParts(date, timeZone);
  const morning = zonedLocalToUtc(parts.year, parts.month, parts.day, QUIET_END_HOUR, 0, timeZone);
  if (morning.getTime() > date.getTime()) return morning;
  const tomorrow = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) + 24 * 60 * 60 * 1000);
  return zonedLocalToUtc(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth() + 1,
    tomorrow.getUTCDate(),
    QUIET_END_HOUR,
    0,
    timeZone
  );
}

export function nextLocalMidnight(date: Date, timeZone: string): Date {
  const parts = zonedParts(date, timeZone);
  const tomorrow = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) + 24 * 60 * 60 * 1000);
  return zonedLocalToUtc(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth() + 1,
    tomorrow.getUTCDate(),
    0,
    0,
    timeZone
  );
}

export function formatLocalTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatLocalDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function kidTitle(name: string, title: string): string {
  const trimmed = name.trim();
  if (!trimmed) return title;
  if (title.startsWith("Your ")) return `${trimmed}'s ${title.slice(5)}`;
  return `${trimmed}'s ${title.charAt(0).toLowerCase()}${title.slice(1)}`;
}

export function inSendWindow(now: Date, target: Date, windowMs = 6 * 60 * 1000): boolean {
  const delta = now.getTime() - target.getTime();
  return delta >= 0 && delta < windowMs;
}

export function planDelivery(input: {
  type: string;
  now: Date;
  timeZone: string;
  categoryEnabled: boolean;
  logStatus: string | null;
  notBefore?: Date | null;
  sentNonClassToday: number;
  expiresAt?: Date | null;
  kidProfileId?: string | null;
}): DeliveryPlan {
  if (input.kidProfileId && KID_BLOCKED_TYPES.has(input.type)) {
    return { action: "skip", reason: "not sent about a kid profile" };
  }
  if (!input.categoryEnabled) return { action: "skip", reason: "category off" };
  if (input.logStatus && TERMINAL_LOG_STATUSES.has(input.logStatus)) {
    return { action: "skip", reason: `already ${input.logStatus}` };
  }
  if (
    input.logStatus === "deferred" &&
    input.notBefore &&
    input.notBefore.getTime() > input.now.getTime()
  ) {
    return { action: "defer", notBefore: input.notBefore, reason: "waiting" };
  }

  let notBefore: Date | null = null;
  let reason = "";

  if (isQuietHours(input.now, input.timeZone) && !QUIET_HOURS_ALLOWED.has(input.type)) {
    notBefore = nextLocalMorning(input.now, input.timeZone);
    reason = "quiet hours";
  }

  if (!CAP_EXEMPT.has(input.type) && input.sentNonClassToday >= DAILY_NON_CLASS_CAP) {
    const capUntil = nextLocalMidnight(input.now, input.timeZone);
    if (!notBefore || capUntil.getTime() > notBefore.getTime()) {
      notBefore = capUntil;
      reason = "daily cap";
    }
  }

  if (notBefore) {
    if (input.expiresAt && input.expiresAt.getTime() <= notBefore.getTime()) {
      return { action: "drop", reason: `${reason}; no longer relevant` };
    }
    return { action: "defer", notBefore, reason };
  }

  return { action: "send" };
}

export const STREAK_MILESTONES = [7, 30, 50, 100, 365] as const;

export function isStreakMilestone(streak: number): boolean {
  return (STREAK_MILESTONES as readonly number[]).includes(streak);
}
