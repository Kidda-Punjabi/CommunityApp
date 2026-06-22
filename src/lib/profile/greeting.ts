/** Hour in local time (0–23) → greeting prefix before the user's name. */
export function getTimeAwareGreetingPrefix(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Hi";
}

export function getTimeAwareGreeting(displayName: string | null, hour: number): string {
  const prefix = getTimeAwareGreetingPrefix(hour);
  return displayName ? `${prefix}, ${displayName}` : prefix === "Hi" ? "Hello" : prefix;
}
