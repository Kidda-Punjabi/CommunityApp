import "server-only";

import { APP_REVIEW_USER_ID } from "@/lib/community/constants";
import { formatNextSessionWhen, formatSessionClock, nextLocalStart } from "@/lib/community/format";
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
        .select("id, starts_at, ends_at")
        .eq("session_id", mainSessionId)
        .lt("ends_at", now.toISOString())
        .neq("status", "cancelled")
        .order("starts_at", { ascending: false })
        .limit(12)
    : { data: [] as { id: string; starts_at: string; ends_at: string }[] };

  const pastIds = (past ?? []).map((row) => row.id as string);
  const { data: myCheckins } = pastIds.length
    ? await admin
        .from("community_checkins")
        .select("occurrence_id")
        .eq("user_id", userId)
        .in("occurrence_id", pastIds)
    : { data: [] as { occurrence_id: string }[] };
  const attendedIds = new Set((myCheckins ?? []).map((row) => row.occurrence_id as string));

  const streakRows: StreakOccurrence[] = (past ?? []).map((row) => ({
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    attended: attendedIds.has(row.id as string),
  }));

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
  const [pkg, profile, host, roles] = await Promise.all([
    admin
      .from("student_packages")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", COMMUNITY_COURSE_ID)
      .eq("status", "confirmed")
      .limit(1)
      .maybeSingle(),
    admin.from("profiles").select("app_role").eq("id", userId).maybeSingle(),
    admin
      .from("community_sessions")
      .select("id")
      .eq("host_tutor_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
    admin.from("profile_roles").select("role").eq("user_id", userId),
  ]);
  if (pkg.error) throw pkg.error;
  if (pkg.data) return true;
  if (host.error) throw host.error;
  if (host.data) return true;
  if (profile.data?.app_role === "master_admin") return true;
  if ((roles.data ?? []).some((row) => row.role === "master_admin")) return true;
  return false;
}

export async function loadCommunityCardLine(
  admin: SupabaseClient,
  userId: string
): Promise<{ line: string; live: boolean; startsAt: string | null }> {
  const now = new Date().toISOString();
  const [{ data: profile }, { data: meta }, { data: upcoming, error }] = await Promise.all([
    admin.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
    admin.from("community_memberships_meta").select("main_session_id").eq("user_id", userId).maybeSingle(),
    admin
      .from("community_session_occurrences")
      .select("session_id, starts_at, status, community_sessions!inner(is_active)")
      .eq("community_sessions.is_active", true)
      .gte("ends_at", now)
      .neq("status", "cancelled")
      .order("starts_at", { ascending: true })
      .limit(20),
  ]);
  if (error) throw error;
  const mainId = (meta?.main_session_id as string | null) ?? null;
  const rows = upcoming ?? [];
  const row = (mainId ? rows.find((item) => item.session_id === mainId) : null) ?? rows[0] ?? null;
  if (!row) return { line: "Next session", live: false, startsAt: null };
  const timeZone = (profile?.timezone as string | null) || "Europe/London";
  return {
    line: `Next session · ${formatNextSessionWhen(row.starts_at as string, timeZone)}`,
    live: row.status === "live",
    startsAt: row.starts_at as string,
  };
}

export function isReviewAccount(userId: string): boolean {
  return userId === APP_REVIEW_USER_ID;
}
