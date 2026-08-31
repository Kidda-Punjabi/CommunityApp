import "server-only";

import {
  COMMUNITY_CLASS_FEEDBACK_LOOKBACK_DAYS,
  COMMUNITY_CLASS_TITLE_NEEDLE,
} from "@/lib/feedback/constants";
import {
  loadFeedbackContext,
  matchTutorName,
} from "@/lib/feedback/load-feedback-context";
import type { FeedbackContext } from "@/lib/feedback/types";
import { formatSessionWhenUk } from "@/lib/calendar/uk-display-time";
import { getDisplayName } from "@/lib/profile/display-name";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CommunityClassFeedbackSession = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  tutorName: string | null;
  submitted: boolean;
};

type RawCommunitySession = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  tutor_id: string;
  student_id: string | null;
  match_method: string | null;
  google_event_id: string | null;
};

type TutorNameFields = {
  displayName: string | null;
  fullName: string | null;
};

function communityClassLookbackIso(now = new Date()): string {
  return new Date(
    now.getTime() - COMMUNITY_CLASS_FEEDBACK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
}

export function isCommunityClassSessionTitle(title: string | null | undefined): boolean {
  return (title ?? "").toLowerCase().includes(COMMUNITY_CLASS_TITLE_NEEDLE.toLowerCase());
}

export function communityClassLessonLabel(startsAt: string): string {
  return formatSessionWhenUk(startsAt);
}

function groupKeyForSession(session: RawCommunitySession): string {
  return session.google_event_id?.trim() || session.id;
}

function canonicalScore(session: RawCommunitySession, tutor: TutorNameFields | undefined): number {
  let score = 0;
  const { notionTutor } = matchTutorName(tutor?.fullName, tutor?.displayName);
  if (notionTutor) score += 10;
  if (session.match_method && session.match_method !== "unmatched") score += 5;
  if (tutor?.displayName && tutor.displayName.toLowerCase() !== "kidda") score += 2;
  return score;
}

function pickCanonical(rows: RawCommunitySession[], tutors: Map<string, TutorNameFields>): RawCommunitySession {
  return [...rows].sort((a, b) => {
    const scoreDiff =
      canonicalScore(b, tutors.get(b.tutor_id)) - canonicalScore(a, tutors.get(a.tutor_id));
    if (scoreDiff !== 0) return scoreDiff;
    return a.id.localeCompare(b.id);
  })[0];
}

async function loadTutorNames(
  admin: SupabaseClient,
  tutorIds: string[]
): Promise<Map<string, TutorNameFields>> {
  const uniqueIds = [...new Set(tutorIds.filter(Boolean))];
  const tutors = new Map<string, TutorNameFields>();
  if (uniqueIds.length === 0) return tutors;

  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, preferred_name")
    .in("id", uniqueIds);

  if (error) throw error;

  for (const row of data ?? []) {
    const displayName = getDisplayName(row);
    tutors.set(row.id as string, {
      displayName,
      fullName: row.full_name?.trim() || displayName,
    });
  }

  return tutors;
}

async function queryEligibleCommunityClassSessions(
  admin: SupabaseClient
): Promise<RawCommunitySession[]> {
  const now = new Date();
  const nowIso = now.toISOString();
  const lookbackIso = communityClassLookbackIso(now);

  const { data, error } = await admin
    .from("tutor_scheduled_sessions")
    .select("id, title, starts_at, ends_at, tutor_id, student_id, match_method, google_event_id")
    .ilike("title", `%${COMMUNITY_CLASS_TITLE_NEEDLE}%`)
    .eq("status", "scheduled")
    .lte("starts_at", nowIso)
    .gte("starts_at", lookbackIso)
    .order("starts_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as RawCommunitySession[];
}

async function loadSiblingSessionIds(
  admin: SupabaseClient,
  session: RawCommunitySession
): Promise<string[]> {
  const eventId = session.google_event_id?.trim();
  if (!eventId) return [session.id];

  const { data, error } = await admin
    .from("tutor_scheduled_sessions")
    .select("id")
    .eq("google_event_id", eventId)
    .ilike("title", `%${COMMUNITY_CLASS_TITLE_NEEDLE}%`);

  if (error) throw error;
  const ids = (data ?? []).map((row) => row.id as string);
  return ids.length > 0 ? ids : [session.id];
}

async function loadSubmittedSessionIds(
  supabase: SupabaseClient,
  userId: string,
  sessionIds: string[]
): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("feedback_submissions")
    .select("session_id")
    .eq("user_id", userId)
    .in("session_id", sessionIds)
    .not("session_id", "is", null);

  if (error) throw error;
  return new Set(
    (data ?? [])
      .map((row) => row.session_id as string | null)
      .filter((id): id is string => Boolean(id))
  );
}

export async function userHasCommunityClassFeedback(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  userId: string,
  session: RawCommunitySession
): Promise<boolean> {
  const siblingIds = await loadSiblingSessionIds(admin, session);
  const submitted = await loadSubmittedSessionIds(supabase, userId, siblingIds);
  return siblingIds.some((id) => submitted.has(id));
}

function dedupeCommunityClassSessions(
  rows: RawCommunitySession[],
  tutors: Map<string, TutorNameFields>
): Array<{ canonical: RawCommunitySession; siblingIds: string[] }> {
  const groups = new Map<string, RawCommunitySession[]>();
  for (const row of rows) {
    const key = groupKeyForSession(row);
    const existing = groups.get(key);
    if (existing) existing.push(row);
    else groups.set(key, [row]);
  }

  return [...groups.values()]
    .map((group) => ({
      canonical: pickCanonical(group, tutors),
      siblingIds: group.map((row) => row.id),
    }))
    .sort(
      (a, b) =>
        new Date(b.canonical.starts_at).getTime() - new Date(a.canonical.starts_at).getTime()
    );
}

export async function loadCommunityClassFeedbackSessions(
  supabase: SupabaseClient,
  userId: string
): Promise<CommunityClassFeedbackSession[]> {
  const service = tryCreateServiceRoleClient();
  if (service.error || !service.client) {
    console.error("[community-class-feedback] service role unavailable:", service.error);
    return [];
  }

  const admin = service.client;
  const rows = await queryEligibleCommunityClassSessions(admin);
  const tutors = await loadTutorNames(
    admin,
    rows.map((row) => row.tutor_id)
  );
  const groups = dedupeCommunityClassSessions(rows, tutors);
  const allIds = groups.flatMap((group) => group.siblingIds);
  const submittedIds = await loadSubmittedSessionIds(supabase, userId, allIds);

  return groups.map(({ canonical, siblingIds }) => {
    const tutor = tutors.get(canonical.tutor_id);
    return {
      id: canonical.id,
      title: canonical.title,
      startsAt: canonical.starts_at,
      endsAt: canonical.ends_at,
      tutorName: tutor?.displayName ?? tutor?.fullName ?? null,
      submitted: siblingIds.some((id) => submittedIds.has(id)),
    };
  });
}

export async function loadCommunityClassFeedbackContext(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  sessionId: string,
  options?: { phone?: string | null }
): Promise<
  | { ok: true; context: FeedbackContext; alreadySubmitted: boolean }
  | { ok: false; error: string }
> {
  const service = tryCreateServiceRoleClient();
  if (service.error || !service.client) {
    return { ok: false, error: service.error ?? "Could not load this class." };
  }

  const admin = service.client;
  const { data: session, error } = await admin
    .from("tutor_scheduled_sessions")
    .select("id, title, starts_at, ends_at, tutor_id, student_id, match_method, google_event_id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!session) return { ok: false, error: "Class not found." };

  const raw = session as RawCommunitySession & { status: string };
  if (!isCommunityClassSessionTitle(raw.title)) {
    return { ok: false, error: "Class not found." };
  }
  if (raw.status !== "scheduled") {
    return { ok: false, error: "Class not found." };
  }

  const startsAt = new Date(raw.starts_at).getTime();
  const now = Date.now();
  const lookbackMs = COMMUNITY_CLASS_FEEDBACK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  if (Number.isNaN(startsAt) || startsAt > now) {
    return { ok: false, error: "Feedback opens once this class has started." };
  }
  if (startsAt < now - lookbackMs) {
    return { ok: false, error: "Feedback for this class is no longer open." };
  }

  const tutors = await loadTutorNames(admin, [raw.tutor_id]);
  const tutor = tutors.get(raw.tutor_id);
  const { notionTutor, tutorUnmatched } = matchTutorName(tutor?.fullName, tutor?.displayName);

  const base = await loadFeedbackContext(supabase, userId, email, {
    phone: options?.phone,
  });

  const alreadySubmitted = await userHasCommunityClassFeedback(supabase, admin, userId, raw);

  return {
    ok: true,
    alreadySubmitted,
    context: {
      ...base,
      cohort: "Community",
      course: "Community",
      lessonLabel: communityClassLessonLabel(raw.starts_at),
      lessonNumber: null,
      tutor: tutor?.displayName ?? tutor?.fullName ?? null,
      notionTutor,
      tutorUnmatched,
      lessonId: null,
      sessionId: raw.id,
      formVariant: "community",
    },
  };
}
