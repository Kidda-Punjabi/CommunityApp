import { daysBetween } from "@/lib/admin/delivery/metrics";

/** Relative “how long open” label, e.g. “3 days ago”. Reuses `daysBetween` for day-scale values. */
export function formatTimeOpen(fromIso: string | null | undefined, now: Date = new Date()): string {
  if (!fromIso) return "—";
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from)) return "—";

  const ms = Math.max(0, now.getTime() - from);
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;

  const days = daysBetween(fromIso, now);
  if (days == null) return "—";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
