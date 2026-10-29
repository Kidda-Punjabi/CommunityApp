import "server-only";

import {
  communityFeedbackSessionIdForEvent,
  loadCommunityClassFeedbackContext,
} from "@/lib/feedback/community-class";
import { loadFeedbackContext } from "@/lib/feedback/load-feedback-context";
import type { FeedbackContext } from "@/lib/feedback/types";
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

/**
 * Everyone who checked in gets one notification linking to the feedback form. Sent when the
 * host brings everyone back (or at the end, if they never did); only ever once per session.
 */
export async function notifySessionFeedback(admin: SupabaseClient, occurrenceId: string, actorId: string) {
  const { data: occurrence } = await admin
    .from("community_session_occurrences")
    .select("id, google_event_id, feedback_prompted_at, community_sessions(title, is_active)")
    .eq("id", occurrenceId)
    .maybeSingle();
  if (!occurrence) return;
  if (occurrence.feedback_prompted_at) return;
  const session = Array.isArray(occurrence.community_sessions) ? occurrence.community_sessions[0] : occurrence.community_sessions;
  if (session?.is_active === false) return; // test sessions count for nothing
  const form = await communityFeedbackSessionIdForEvent(admin, occurrence.google_event_id as string | null);
  if (!form) return;
  // Claim the send first, so a double tap or Bring back + End can't notify twice.
  const { data: claimed } = await admin
    .from("community_session_occurrences")
    .update({ feedback_prompted_at: new Date().toISOString() })
    .eq("id", occurrenceId)
    .is("feedback_prompted_at", null)
    .select("id");
  if (!claimed || claimed.length === 0) return;
  const { data: checkins } = await admin.from("community_checkins").select("user_id").eq("occurrence_id", occurrenceId);
  const title = session?.title ?? "Community";
  for (const row of checkins ?? []) {
    // One member's failed send must not stop the rest.
    try {
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
    } catch (error) {
      console.error("[community] feedback notification failed for one member", error);
    }
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

export type MainRoomFeedback =
  | { mode: "form"; context: FeedbackContext; sessionId: string }
  | { mode: "sent" }
  /** Test sessions and staff: the real form, but nothing is sent. */
  | { mode: "preview"; context: FeedbackContext; reason: "test" | "staff" }
  | { mode: "unavailable" };

/**
 * What a member's phone shows for feedback once the host brings everyone back: the real
 * Community feedback form (it saves to Supabase and syncs to Notion), or a thank-you.
 */
export async function loadMainRoomFeedback(
  admin: SupabaseClient,
  supabase: SupabaseClient,
  user: { id: string; email: string | null | undefined; phone?: string | null },
  occurrenceId: string
): Promise<MainRoomFeedback> {
  if (!user.email) return { mode: "unavailable" };
  const { data: occurrence } = await admin
    .from("community_session_occurrences")
    .select("google_event_id, community_sessions(is_active)")
    .eq("id", occurrenceId)
    .maybeSingle();
  if (!occurrence) return { mode: "unavailable" };
  const session = Array.isArray(occurrence.community_sessions)
    ? occurrence.community_sessions[0]
    : occurrence.community_sessions;
  const isTest = session?.is_active === false;
  const isStaff = await isCommunityStaffUser(admin, user.id);

  const form = isTest
    ? null
    : await communityFeedbackSessionIdForEvent(admin, occurrence.google_event_id as string | null);

  if (form && !isStaff) {
    const loaded = await loadCommunityClassFeedbackContext(supabase, user.id, user.email, form.id, {
      phone: user.phone,
    });
    if (!loaded.ok) return { mode: "unavailable" };
    if (loaded.alreadySubmitted) return { mode: "sent" };
    return { mode: "form", context: loaded.context, sessionId: loaded.context.sessionId ?? form.id };
  }

  if (isTest || isStaff) {
    const base = await loadFeedbackContext(supabase, user.id, user.email, { phone: user.phone });
    return {
      mode: "preview",
      reason: isTest ? "test" : "staff",
      context: {
        ...base,
        cohort: "Community",
        course: "Community",
        lessonLabel: isTest ? "Test session" : "This session",
        lessonNumber: null,
        tutor: null,
        notionTutor: null,
        tutorUnmatched: false,
        lessonId: null,
        sessionId: null,
        formVariant: "community",
      },
    };
  }

  return { mode: "unavailable" };
}
