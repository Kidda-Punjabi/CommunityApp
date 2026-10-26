import "server-only";

import { communityFeedbackSessionIdForEvent } from "@/lib/feedback/community-class";
import { insertRoutedNotifications } from "@/lib/notifications/insert-notifications";
import { isCommunityStaffUser } from "@/lib/community/test-sessions";
import type { SupabaseClient } from "@supabase/supabase-js";

/** How long after a session ends members are still asked for feedback on the Community tab. */
const FEEDBACK_PROMPT_HOURS = 48;

export type PendingSessionFeedback = { formSessionId: string; title: string };

type EndedRow = {
  id: string;
  ended_at: string | null;
  google_event_id: string | null;
  community_sessions: { title: string; is_active: boolean } | { title: string; is_active: boolean }[] | null;
};

function sessionOf(row: EndedRow) {
  return Array.isArray(row.community_sessions) ? row.community_sessions[0] : row.community_sessions;
}

/**
 * The most recent real (not test) session this member checked into, ended in the last 48 hours,
 * that they haven't given feedback for yet.
 */
export async function pendingSessionFeedback(admin: SupabaseClient, userId: string): Promise<PendingSessionFeedback | null> {
  // Hosts and admins don't rate their own sessions.
  if (await isCommunityStaffUser(admin, userId)) return null;
  const since = new Date(Date.now() - FEEDBACK_PROMPT_HOURS * 60 * 60 * 1000).toISOString();
  const { data: checkins, error } = await admin
    .from("community_checkins")
    .select("occurrence_id, community_session_occurrences!inner(id, status, ended_at, google_event_id, community_sessions(title, is_active))")
    .eq("user_id", userId)
    .eq("community_session_occurrences.status", "ended")
    .gte("community_session_occurrences.ended_at", since);
  if (error) throw error;
  const ended = (checkins ?? [])
    .map((row) => {
      const occurrence = row.community_session_occurrences as unknown as EndedRow | EndedRow[];
      return Array.isArray(occurrence) ? occurrence[0] : occurrence;
    })
    .filter((row): row is EndedRow => Boolean(row) && sessionOf(row)?.is_active !== false)
    .sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? ""));

  for (const occurrence of ended) {
    const form = await communityFeedbackSessionIdForEvent(admin, occurrence.google_event_id);
    if (!form) continue;
    const { data: sent } = await admin
      .from("feedback_submissions")
      .select("id")
      .eq("user_id", userId)
      .in("session_id", form.siblingIds)
      .limit(1)
      .maybeSingle();
    if (sent) continue;
    return { formSessionId: form.id, title: sessionOf(occurrence)?.title ?? "Community" };
  }
  return null;
}

/** When a real session ends, everyone who checked in gets a notification linking to the feedback form. */
export async function notifySessionFeedback(admin: SupabaseClient, occurrenceId: string, actorId: string) {
  const { data: occurrence } = await admin
    .from("community_session_occurrences")
    .select("id, google_event_id, community_sessions(title, is_active)")
    .eq("id", occurrenceId)
    .maybeSingle();
  if (!occurrence) return;
  const session = Array.isArray(occurrence.community_sessions) ? occurrence.community_sessions[0] : occurrence.community_sessions;
  if (session?.is_active === false) return; // test sessions count for nothing
  const form = await communityFeedbackSessionIdForEvent(admin, occurrence.google_event_id as string | null);
  if (!form) return;
  const { data: checkins } = await admin.from("community_checkins").select("user_id").eq("occurrence_id", occurrenceId);
  const title = session?.title ?? "Community";
  for (const row of checkins ?? []) {
    if (await isCommunityStaffUser(admin, row.user_id as string)) continue;
    await insertRoutedNotifications(admin, {
      type: "community_session_live",
      userId: row.user_id as string,
      actorUserId: actorId,
      payload: {
        title: `How was ${title}? Tell us in a minute`,
        occurrence_id: occurrenceId,
        session_name: title,
        url: `/dashboard/community/feedback/${form.id}`,
      },
    });
  }
}

/** Who has and hasn't sent feedback for a session, for the host's wrap-up. */
export async function sessionFeedbackStatus(
  admin: SupabaseClient,
  occurrence: { google_event_id: string | null; isTest: boolean },
  checkedIn: { userId: string; name: string }[]
): Promise<{ available: boolean; sent: { name: string; notion: boolean; scores: string }[]; notSent: string[] }> {
  if (occurrence.isTest) return { available: false, sent: [], notSent: [] };
  const form = await communityFeedbackSessionIdForEvent(admin, occurrence.google_event_id);
  if (!form || checkedIn.length === 0) return { available: Boolean(form), sent: [], notSent: checkedIn.map((row) => row.name) };
  const { data } = await admin
    .from("feedback_submissions")
    .select("user_id, learning_relevance, tutor_effectiveness, confidence, notion_sync_status")
    .in("session_id", form.siblingIds)
    .in("user_id", checkedIn.map((row) => row.userId));
  const byUser = new Map((data ?? []).map((row) => [row.user_id as string, row]));
  const sent: { name: string; notion: boolean; scores: string }[] = [];
  const notSent: string[] = [];
  for (const person of checkedIn) {
    const row = byUser.get(person.userId);
    if (!row) {
      notSent.push(person.name);
      continue;
    }
    sent.push({
      name: person.name,
      notion: row.notion_sync_status === "synced",
      scores: [row.learning_relevance, row.tutor_effectiveness, row.confidence].map((value) => value ?? "–").join(" · "),
    });
  }
  return { available: true, sent, notSent };
}
