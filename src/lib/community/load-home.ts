import "server-only";

import { APP_REVIEW_USER_ID } from "@/lib/community/constants";
import { formatSessionClock, nextLocalStart } from "@/lib/community/format";
import { currentStreak, sessionsHaveStarted, streakDots, type StreakOccurrence } from "@/lib/community/streak";
import { COMMUNITY_COURSE_ID } from "@/lib/topics/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SlotChoice = {
  id: string;
  title: string;
  weekdayLabel: string;
  startsLabel: string | null;
  firstStartsOn: string | null;
  localWhen: string;
};

export type HomeOccurrence = {
  id: string;
  sessionId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  meetUrl: string | null;
  weekNumber: number;
  topic: string | null;
  sessionTitle: string;
  weekdayLabel: string;
};

export type CommunityHome = {
  timezone: string;
  level: number | null;
  mainSessionId: string | null;
  weekdayLabel: string | null;
  startsLabel: string | null;
  firstStartsOn: string | null;
  pod: { id: string; name: string } | null;
  podmates: { userId: string; name: string; level: number | null }[];
  next: HomeOccurrence | null;
  streak: number;
  dots: { filled: boolean }[];
  sessionsStarted: boolean;
  slots: SlotChoice[];
  step: "session" | "test" | "pod" | "home";
};

type SessionRow = {
  id: string;
  title: string;
  weekday: number;
  weekday_label: string;
  start_time_local: string;
  timezone: string;
  starts_label: string | null;
  first_starts_on: string | null;
};

function occurrenceFrom(
  row: {
    id: string;
    session_id: string;
    starts_at: string;
    ends_at: string;
    status: string;
    meet_url: string | null;
    week_number: number;
    week_number_override: number | null;
    lessons: { title: string } | { title: string }[] | null;
  },
  sessions: Map<string, SessionRow>
): HomeOccurrence {
  const session = sessions.get(row.session_id);
  const lesson = Array.isArray(row.lessons) ? row.lessons[0] : row.lessons;
  return {
    id: row.id,
    sessionId: row.session_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    meetUrl: row.meet_url,
    weekNumber: row.week_number_override ?? row.week_number,
    topic: lesson?.title ?? null,
    sessionTitle: session?.title ?? "Community",
    weekdayLabel: session?.weekday_label ?? "",
  };
}

export async function loadCommunityHome(admin: SupabaseClient, userId: string): Promise<CommunityHome> {
  const now = new Date();
  const [profileResult, metaResult, sessionsResult] = await Promise.all([
    admin.from("profiles").select("timezone, kidda_level, full_name").eq("id", userId).maybeSingle(),
    admin.from("community_memberships_meta").select("main_session_id, pod_id").eq("user_id", userId).maybeSingle(),
    admin.from("community_sessions").select("id, title, weekday, weekday_label, start_time_local, timezone, starts_label, first_starts_on").eq("is_active", true),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (metaResult.error) throw metaResult.error;
  if (sessionsResult.error) throw sessionsResult.error;

  const timezone = profileResult.data?.timezone || "Europe/London";
  const level = profileResult.data?.kidda_level ?? null;
  const sessions = (sessionsResult.data ?? []) as SessionRow[];
  const sessionMap = new Map(sessions.map((session) => [session.id, session]));
  const mainSessionId = metaResult.data?.main_session_id ?? null;
  const main = mainSessionId ? sessionMap.get(mainSessionId) : undefined;

  const { data: upcoming, error: upcomingError } = await admin
    .from("community_session_occurrences")
    .select("id, session_id, starts_at, ends_at, status, meet_url, week_number, week_number_override, lessons(title)")
    .gte("ends_at", now.toISOString())
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true })
    .limit(40);
  if (upcomingError) throw upcomingError;

  const occurrences = (upcoming ?? []).map((row) => occurrenceFrom(row, sessionMap));
  const next = (mainSessionId
    ? occurrences.find((row) => row.sessionId === mainSessionId)
    : occurrences[0]) ?? null;

  let pod: CommunityHome["pod"] = null;
  let podmates: CommunityHome["podmates"] = [];
  if (metaResult.data?.pod_id) {
    const { data: podRow } = await admin.from("pods").select("id, name").eq("id", metaResult.data.pod_id).maybeSingle();
    if (podRow) pod = { id: podRow.id, name: podRow.name };
    const { data: members } = await admin.from("pod_members").select("user_id, profiles(full_name, kidda_level)").eq("pod_id", metaResult.data.pod_id);
    podmates = (members ?? []).map((member) => {
      const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
      return {
        userId: member.user_id as string,
        name: profile?.full_name || "Member",
        level: profile?.kidda_level ?? null,
      };
    });
  }

  const { data: past } = mainSessionId
    ? await admin
        .from("community_session_occurrences")
        .select("id, starts_at, ends_at, community_checkins(user_id)")
        .eq("session_id", mainSessionId)
        .lt("ends_at", now.toISOString())
        .neq("status", "cancelled")
        .order("starts_at", { ascending: false })
        .limit(12)
    : { data: [] };

  const streakRows: StreakOccurrence[] = (past ?? []).map((row) => {
    const checkins = (row.community_checkins ?? []) as { user_id: string }[];
    return {
      startsAt: row.starts_at as string,
      endsAt: row.ends_at as string,
      attended: checkins.some((checkin) => checkin.user_id === userId),
    };
  });

  const slots: SlotChoice[] = sessions
    .map((session) => {
      const upcomingStart = occurrences.find((row) => row.sessionId === session.id)?.startsAt;
      const when = upcomingStart
        ? new Date(upcomingStart)
        : nextLocalStart(session.weekday, session.start_time_local, session.timezone, session.first_starts_on, now);
      return {
        id: session.id,
        title: session.title,
        weekdayLabel: session.weekday_label,
        startsLabel: session.starts_label,
        firstStartsOn: session.first_starts_on,
        localWhen: formatSessionClock(when.toISOString(), timezone),
      };
    })
    .sort((a, b) => a.localWhen.localeCompare(b.localWhen));

  const step = !mainSessionId ? "session" : level == null ? "test" : !pod ? "pod" : "home";

  return {
    timezone,
    level,
    mainSessionId,
    weekdayLabel: main?.weekday_label ?? null,
    startsLabel: main?.starts_label ?? null,
    firstStartsOn: main?.first_starts_on ?? null,
    pod,
    podmates,
    next,
    streak: currentStreak(streakRows, main?.first_starts_on ?? null, now),
    dots: streakDots(streakRows, main?.first_starts_on ?? null, now).map((dot) => ({ filled: dot.filled })),
    sessionsStarted: sessionsHaveStarted(main?.first_starts_on ?? null, now),
    slots,
    step,
  };
}

export async function memberHasCommunity(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("student_packages")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", COMMUNITY_COURSE_ID)
    .eq("status", "confirmed")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export function isReviewAccount(userId: string): boolean {
  return userId === APP_REVIEW_USER_ID;
}
