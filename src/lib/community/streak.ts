export type StreakOccurrence = {
  startsAt: string;
  endsAt: string;
  attended: boolean;
};

export type StreakDot = {
  filled: boolean;
  startsAt: string;
};

export function countableMainOccurrences(
  occurrences: StreakOccurrence[],
  firstStartsOn: string | null,
  now: Date
): StreakOccurrence[] {
  const firstMs = firstStartsOn ? Date.parse(`${firstStartsOn}T00:00:00Z`) : null;
  return occurrences
    .filter((occurrence) => {
      const start = Date.parse(occurrence.startsAt);
      const end = Date.parse(occurrence.endsAt);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
      if (end > now.getTime()) return false;
      if (firstMs != null && start < firstMs) return false;
      return true;
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export function streakDots(occurrences: StreakOccurrence[], firstStartsOn: string | null, now: Date): StreakDot[] {
  const counted = countableMainOccurrences(occurrences, firstStartsOn, now);
  return counted.slice(-6).map((occurrence) => ({
    filled: occurrence.attended,
    startsAt: occurrence.startsAt,
  }));
}

export function currentStreak(occurrences: StreakOccurrence[], firstStartsOn: string | null, now: Date): number {
  const counted = countableMainOccurrences(occurrences, firstStartsOn, now);
  let streak = 0;
  for (let i = counted.length - 1; i >= 0; i -= 1) {
    if (!counted[i].attended) break;
    streak += 1;
  }
  return streak;
}

export function sessionsHaveStarted(firstStartsOn: string | null, now: Date): boolean {
  if (!firstStartsOn) return true;
  return Date.parse(`${firstStartsOn}T00:00:00Z`) <= now.getTime();
}
