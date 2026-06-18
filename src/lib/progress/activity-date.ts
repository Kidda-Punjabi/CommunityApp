export const ACTIVITY_DATE_COOKIE = "kidda_local_date";
export const TIMEZONE_OFFSET_COOKIE = "kidda_tz_offset";

export function getLocalActivityDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Calendar date for a JS getTimezoneOffset() value (works on server). */
export function getLocalActivityDateForOffset(
  timezoneOffsetMinutes: number,
  date = new Date()
): string {
  const local = new Date(date.getTime() - timezoneOffsetMinutes * 60 * 1000);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidActivityDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function normalizeActivityDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.slice(0, 10);
  return isValidActivityDate(normalized) ? normalized : null;
}

export function daysBetweenActivityDates(from: string, to: string): number {
  const fromNorm = normalizeActivityDate(from);
  const toNorm = normalizeActivityDate(to);
  if (!fromNorm || !toNorm) return 0;

  const parse = (value: string) =>
    Date.UTC(
      Number(value.slice(0, 4)),
      Number(value.slice(5, 7)) - 1,
      Number(value.slice(8, 10))
    );

  return Math.round((parse(toNorm) - parse(fromNorm)) / 86_400_000);
}

export type StreakRowSnapshot = {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  redemption_available: boolean;
  streak_broken_date: string | null;
  streak_before_break: number | null;
};

export type StreakPresentation = {
  current_streak: number;
  display_streak: number;
  longest_streak: number;
  redemption_available: boolean;
  streak_at_risk: boolean;
  streak_before_break: number | null;
  rescue_streak: number;
  streak_warning: boolean;
  day_gap: number | null;
};

/** Read-only streak state for display — never mutates the database. */
export function computeStreakPresentation(
  row: StreakRowSnapshot | null,
  today: string
): StreakPresentation {
  const empty: StreakPresentation = {
    current_streak: 0,
    display_streak: 0,
    longest_streak: 0,
    redemption_available: false,
    streak_at_risk: false,
    streak_before_break: null,
    rescue_streak: 0,
    streak_warning: false,
    day_gap: null,
  };

  if (!row) return empty;

  const todayNorm = normalizeActivityDate(today) ?? today;
  const last = normalizeActivityDate(row.last_activity_date);
  const storedCurrent = Math.max(row.current_streak ?? 0, 0);
  const storedLongest = Math.max(row.longest_streak ?? 0, 0);
  const storedBeforeBreak =
    row.streak_before_break == null ? null : Math.max(row.streak_before_break, 0);

  if (!last) {
    return {
      ...empty,
      current_streak: storedCurrent,
      display_streak: storedCurrent,
      longest_streak: Math.max(storedLongest, storedCurrent),
      day_gap: null,
    };
  }

  const gap = daysBetweenActivityDates(last, todayNorm);

  // Redemption window expired (missed rescue day)
  if (
    row.redemption_available &&
    row.streak_broken_date &&
    daysBetweenActivityDates(row.streak_broken_date, todayNorm) > 0
  ) {
    return {
      current_streak: 0,
      display_streak: 0,
      longest_streak: Math.max(storedLongest, storedBeforeBreak ?? storedCurrent),
      redemption_available: false,
      streak_at_risk: false,
      streak_before_break: null,
      rescue_streak: 0,
      streak_warning: false,
      day_gap: gap,
    };
  }

  // Active streak: studied today or yesterday — always show the stored count
  if (gap <= 1) {
    const display = Math.max(storedCurrent, storedBeforeBreak ?? 0);
    return {
      current_streak: storedCurrent,
      display_streak: display,
      longest_streak: Math.max(storedLongest, display),
      redemption_available: false,
      streak_at_risk: gap === 1,
      streak_before_break: storedBeforeBreak,
      rescue_streak: display,
      streak_warning: gap === 1,
      day_gap: gap,
    };
  }

  // Missed yesterday — redemption available, preserve streak number
  if (gap === 2) {
    const preserved = Math.max(storedBeforeBreak ?? storedCurrent, 0);
    return {
      current_streak: storedCurrent,
      display_streak: preserved,
      longest_streak: Math.max(storedLongest, preserved),
      redemption_available: true,
      streak_at_risk: false,
      streak_before_break: preserved,
      rescue_streak: preserved,
      streak_warning: true,
      day_gap: gap,
    };
  }

  // 3+ days missed — streak broken
  return {
    current_streak: 0,
    display_streak: 0,
    longest_streak: Math.max(storedLongest, storedCurrent, storedBeforeBreak ?? 0),
    redemption_available: false,
    streak_at_risk: false,
    streak_before_break: null,
    rescue_streak: 0,
    streak_warning: false,
    day_gap: gap,
  };
}

export function mapStreakRowSnapshot(row: {
  current_streak?: number | null;
  longest_streak?: number | null;
  last_activity_date?: string | null;
  redemption_available?: boolean | null;
  streak_broken_date?: string | null;
  streak_before_break?: number | null;
}): StreakRowSnapshot {
  return {
    current_streak: row.current_streak ?? 0,
    longest_streak: row.longest_streak ?? 0,
    last_activity_date: normalizeActivityDate(row.last_activity_date),
    redemption_available: row.redemption_available ?? false,
    streak_broken_date: normalizeActivityDate(row.streak_broken_date),
    streak_before_break: row.streak_before_break ?? null,
  };
}

export function presentationToHomeStats(presentation: StreakPresentation) {
  return {
    streak: presentation.display_streak,
    longestStreak: presentation.longest_streak,
    redemptionAvailable: presentation.redemption_available,
    streakAtRisk: presentation.streak_at_risk,
    streakWarning: presentation.streak_warning,
    rescueStreak: presentation.rescue_streak,
    dayGap: presentation.day_gap,
  };
}
