import "server-only";

import { ARSH_USER_ID } from "@/lib/community/constants";
import { matchCommunitySlot } from "@/lib/community/match-slot";
import { communityWeekNumber } from "@/lib/community/week-number";
import { COMMUNITY_COURSE_ID } from "@/lib/topics/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

type SlotRow = {
  id: string;
  timezone: string;
  duration_minutes: number;
};

type EventRow = {
  google_event_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  meet_link: string | null;
};

type ExistingOccurrence = {
  id: string;
  google_event_id: string | null;
  status: string;
  week_number_override: number | null;
};

const LOOKAHEAD_MS = 180 * 24 * 60 * 60 * 1000;

export async function syncCommunityOccurrences(
  admin: SupabaseClient,
  tutorId: string
): Promise<{ matched: number }> {
  if (tutorId !== ARSH_USER_ID) return { matched: 0 };

  const from = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + LOOKAHEAD_MS).toISOString();

  const [slotsResult, eventsResult, lessonsResult, existingResult] = await Promise.all([
    admin.from("community_sessions").select("id, timezone, duration_minutes").eq("is_active", true),
    admin
      .from("tutor_scheduled_sessions")
      .select("google_event_id, title, starts_at, ends_at, meet_link")
      .eq("tutor_id", tutorId)
      .gte("starts_at", from)
      .lte("starts_at", to),
    admin.from("lessons").select("id, lesson_number").eq("course_id", COMMUNITY_COURSE_ID),
    admin
      .from("community_session_occurrences")
      .select("id, google_event_id, status, week_number_override")
      .gte("starts_at", from)
      .lte("starts_at", to),
  ]);

  if (slotsResult.error) throw slotsResult.error;
  if (eventsResult.error) throw eventsResult.error;
  if (lessonsResult.error) throw lessonsResult.error;
  if (existingResult.error) throw existingResult.error;

  const slots = new Map((slotsResult.data as SlotRow[]).map((slot) => [slot.id, slot]));
  const lessons = new Map(
    (lessonsResult.data as { id: string; lesson_number: number }[]).map((lesson) => [
      lesson.lesson_number,
      lesson.id,
    ])
  );
  const existing = new Map(
    (existingResult.data as ExistingOccurrence[])
      .filter((row) => row.google_event_id)
      .map((row) => [row.google_event_id as string, row])
  );

  const seen = new Set<string>();
  let matched = 0;

  for (const event of eventsResult.data as EventRow[]) {
    const slotId = matchCommunitySlot(event.title, event.starts_at);
    const slot = slotId ? slots.get(slotId) : undefined;
    if (!slot) continue;
    seen.add(event.google_event_id);
    matched += 1;

    const prior = existing.get(event.google_event_id);
    const startsAt = event.starts_at;
    const endsAt =
      event.ends_at ??
      new Date(Date.parse(startsAt) + slot.duration_minutes * 60 * 1000).toISOString();
    const weekNumber = communityWeekNumber(new Date(startsAt), slot.timezone);
    const effectiveWeek = prior?.week_number_override ?? weekNumber;
    const locked = prior?.status === "live" || prior?.status === "ended";
    const status = locked ? prior.status : prior?.status === "cancelled" ? "scheduled" : (prior?.status ?? "scheduled");

    const payload = {
      session_id: slot.id,
      starts_at: locked ? undefined : startsAt,
      ends_at: locked ? undefined : endsAt,
      topic_lesson_id: lessons.get(effectiveWeek) ?? null,
      week_number: weekNumber,
      google_event_id: event.google_event_id,
      meet_url: event.meet_link,
      status,
      late_after: locked ? undefined : new Date(Date.parse(startsAt) + 5 * 60 * 1000).toISOString(),
    };

    const cleaned = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

    if (prior) {
      const { error } = await admin.from("community_session_occurrences").update(cleaned).eq("id", prior.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("community_session_occurrences").insert({
        ...cleaned,
        starts_at: startsAt,
        ends_at: endsAt,
        late_after: new Date(Date.parse(startsAt) + 5 * 60 * 1000).toISOString(),
        status: "scheduled",
      });
      if (error) throw error;
    }

    if (event.meet_link) {
      await admin.from("community_sessions").update({ meet_url: event.meet_link }).eq("id", slot.id);
    }
  }

  const missing = (existingResult.data as ExistingOccurrence[]).filter(
    (row) =>
      row.google_event_id &&
      !seen.has(row.google_event_id) &&
      row.status === "scheduled"
  );
  if (missing.length > 0) {
    const { error } = await admin
      .from("community_session_occurrences")
      .update({ status: "cancelled" })
      .in(
        "id",
        missing.map((row) => row.id)
      );
    if (error) throw error;
  }

  return { matched };
}
