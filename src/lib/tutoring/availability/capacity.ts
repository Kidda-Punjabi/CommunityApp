import { startOfWeekMonday } from "@/lib/calendar/time-grid-calendar";
import type { ScheduledSessionRow } from "@/lib/calendar/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TutorCapacitySummary } from "./types";

function sessionDurationHours(startsAt: string, endsAt: string): number {
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  return Math.max(0, ms / (1000 * 60 * 60));
}

export function computeWeeklyCapacityUsed(
  sessions: Pick<ScheduledSessionRow, "starts_at" | "ends_at">[],
  weekAnchor = new Date()
): number {
  const weekStart = startOfWeekMonday(weekAnchor);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return sessions
    .filter((session) => {
      const start = new Date(session.starts_at);
      return start >= weekStart && start < weekEnd;
    })
    .reduce((total, session) => total + sessionDurationHours(session.starts_at, session.ends_at), 0);
}

export function buildCapacitySummary(
  weeklyCapacityHours: number,
  usedHours: number,
  weekAnchor = new Date()
): TutorCapacitySummary {
  const weekStart = startOfWeekMonday(weekAnchor);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const weekLabel = `${formatter.format(weekStart)} – ${formatter.format(weekEnd)}`;

  const remainingHours = Math.max(0, weeklyCapacityHours - usedHours);
  const utilizationPercent =
    weeklyCapacityHours > 0 ? Math.min(100, Math.round((usedHours / weeklyCapacityHours) * 100)) : 0;

  return {
    weekLabel,
    weeklyCapacityHours,
    usedHours: Math.round(usedHours * 10) / 10,
    remainingHours: Math.round(remainingHours * 10) / 10,
    utilizationPercent,
  };
}

export async function loadTutorCapacitySummary(
  supabase: SupabaseClient,
  tutorId: string,
  weeklyCapacityHours: number,
  weekAnchor = new Date()
): Promise<TutorCapacitySummary> {
  const weekStart = startOfWeekMonday(weekAnchor);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const { data: sessions } = await supabase
    .from("tutor_scheduled_sessions")
    .select("starts_at, ends_at")
    .eq("tutor_id", tutorId)
    .eq("status", "scheduled")
    .gte("starts_at", weekStart.toISOString())
    .lt("starts_at", weekEnd.toISOString());

  const usedHours = computeWeeklyCapacityUsed(sessions ?? [], weekAnchor);
  return buildCapacitySummary(weeklyCapacityHours, usedHours, weekAnchor);
}

export function formatHours(hours: number): string {
  if (hours === 1) return "1 hour";
  if (Number.isInteger(hours)) return `${hours} hours`;
  return `${hours.toFixed(1)} hours`;
}
