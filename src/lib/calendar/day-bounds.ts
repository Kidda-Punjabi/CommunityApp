/** Local calendar date key (YYYY-MM-DD) for an instant in a timezone. */
export function localDateKey(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone });
}

export function todayDateKey(timeZone: string, reference = new Date()): string {
  return reference.toLocaleDateString("en-CA", { timeZone });
}
