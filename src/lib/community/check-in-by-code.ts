import "server-only";

import {
  CHECKIN_BAD_CODE,
  CHECKIN_NOT_LIVE,
  CHECKIN_TOO_MANY,
  type CheckInMate,
  type CheckInResponse,
  type CheckInSuccess,
} from "@/lib/community/check-in-types";
import { isCheckinCode } from "@/lib/community/checkin-code";
import { placeLateCheckIn } from "@/lib/community/breakout";
import { checkInMember } from "@/lib/community/mutations";
import { currentStreak, type StreakOccurrence } from "@/lib/community/streak";
import type { SupabaseClient } from "@supabase/supabase-js";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

async function placeCheckedInMember(admin: SupabaseClient, occurrenceId: string, userId: string) {
  try {
    await placeLateCheckIn(admin, occurrenceId, userId);
  } catch (error) {
    console.error("[community] late room suggestion failed", error);
  }
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function attemptsAreBlocked(admin: SupabaseClient, userId: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await admin
    .from("community_checkin_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) throw error;
  if ((count ?? 0) >= MAX_ATTEMPTS) return true;
  const { error: insertError } = await admin.from("community_checkin_attempts").insert({ user_id: userId });
  if (insertError) throw insertError;
  return false;
}

async function mainStreak(
  admin: SupabaseClient,
  userId: string,
  occurrence: { session_id: string; starts_at: string; ends_at: string }
): Promise<{ countsForStreak: boolean; streak: number }> {
  const { data: meta, error } = await admin
    .from("community_memberships_meta")
    .select("main_session_id, community_sessions(first_starts_on)")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const mainSessionId = (meta?.main_session_id as string | null) ?? null;
  if (!mainSessionId || mainSessionId !== occurrence.session_id) return { countsForStreak: false, streak: 0 };
  const { data: past, error: pastError } = await admin
    .from("community_session_occurrences")
    .select("starts_at, ends_at, community_checkins(user_id)")
    .eq("session_id", mainSessionId)
    .lte("ends_at", occurrence.ends_at)
    .neq("status", "cancelled");
  if (pastError) throw pastError;
  const rows: StreakOccurrence[] = (past ?? []).map((row) => ({
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    attended:
      ((row.community_checkins ?? []) as { user_id: string }[]).some((checkin) => checkin.user_id === userId) ||
      row.starts_at === occurrence.starts_at,
  }));
  const session = one(meta?.community_sessions as { first_starts_on: string | null } | { first_starts_on: string | null }[] | null);
  return { countsForStreak: true, streak: currentStreak(rows, session?.first_starts_on ?? null, new Date()) };
}

async function presentCheckIn(
  admin: SupabaseClient,
  userId: string,
  occurrenceId: string,
  extra: { already: boolean; countsForStreak: boolean | null; streak: number | null; xpAwarded: number }
): Promise<CheckInSuccess> {
  const { data: occurrence, error } = await admin
    .from("community_session_occurrences")
    .select("id, session_id, starts_at, ends_at, meet_url, community_sessions(title, meet_url)")
    .eq("id", occurrenceId)
    .maybeSingle();
  if (error) throw error;
  const session = one(
    occurrence?.community_sessions as
      | { title: string | null; meet_url: string | null }
      | { title: string | null; meet_url: string | null }[]
      | null
  );
  const streak =
    extra.countsForStreak == null || extra.streak == null
      ? await mainStreak(admin, userId, {
          session_id: occurrence?.session_id as string,
          starts_at: occurrence?.starts_at as string,
          ends_at: occurrence?.ends_at as string,
        })
      : { countsForStreak: extra.countsForStreak, streak: extra.streak };

  const { data: checkins, error: checkinError } = await admin
    .from("community_checkins")
    .select("user_id, profiles(full_name, kidda_level)")
    .eq("occurrence_id", occurrenceId)
    .neq("user_id", userId);
  if (checkinError) throw checkinError;
  const others: CheckInMate[] = (checkins ?? []).map((row) => {
    const profile = one(row.profiles as { full_name: string | null; kidda_level: number | null } | { full_name: string | null; kidda_level: number | null }[] | null);
    return {
      id: row.user_id as string,
      name: profile?.full_name || "Member",
      level: profile?.kidda_level ?? null,
    };
  });

  return {
    ok: true,
    already: extra.already,
    sessionName: session?.title || "Community",
    countsForStreak: streak.countsForStreak,
    streak: streak.streak,
    meetUrl: (occurrence?.meet_url as string | null) || session?.meet_url || null,
    others,
    xpAwarded: extra.xpAwarded,
  };
}

export async function completeOccurrenceCheckIn(
  admin: SupabaseClient,
  userId: string,
  occurrenceId: string,
  code: string
): Promise<CheckInResponse> {
  const { data: existing, error: existingError } = await admin
    .from("community_checkins")
    .select("id")
    .eq("occurrence_id", occurrenceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    await placeCheckedInMember(admin, occurrenceId, userId);
    return presentCheckIn(admin, userId, occurrenceId, {
      already: true,
      countsForStreak: null,
      streak: null,
      xpAwarded: 0,
    });
  }

  const result = await checkInMember(admin, userId, occurrenceId, code, false);
  if ("error" in result && result.error) return { error: result.error };
  if (!("ok" in result) || !result.ok) return { error: CHECKIN_BAD_CODE };
  await placeCheckedInMember(admin, occurrenceId, userId);
  return presentCheckIn(admin, userId, occurrenceId, {
    already: false,
    countsForStreak: result.countsForStreak,
    streak: result.streak,
    xpAwarded: result.xpAwarded,
  });
}

export async function checkInByCodeForMember(admin: SupabaseClient, userId: string, rawCode: string): Promise<CheckInResponse> {
  if (await attemptsAreBlocked(admin, userId)) return { error: CHECKIN_TOO_MANY };

  const { count, error: liveError } = await admin
    .from("community_session_occurrences")
    .select("id", { count: "exact", head: true })
    .eq("status", "live");
  if (liveError) throw liveError;
  if (!count) return { error: CHECKIN_NOT_LIVE };

  const code = rawCode.trim().toUpperCase();
  if (!isCheckinCode(code)) return { error: CHECKIN_BAD_CODE };

  const { data: match, error } = await admin
    .from("community_session_occurrences")
    .select("id")
    .eq("status", "live")
    .eq("checkin_code", code)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!match) return { error: CHECKIN_BAD_CODE };

  const result = await completeOccurrenceCheckIn(admin, userId, match.id as string, code);
  if ("error" in result && result.error === "Check-in is only open while the session is live.") {
    return { error: CHECKIN_NOT_LIVE };
  }
  if ("error" in result && result.error === "That code doesn't match.") {
    return { error: CHECKIN_BAD_CODE };
  }
  return result;
}

export async function liveCheckInFlags(
  admin: SupabaseClient,
  userId: string,
  nextOccurrenceId: string | null
): Promise<{ anyLive: boolean; checkedIntoNext: boolean }> {
  const { data: live, error } = await admin.from("community_session_occurrences").select("id").eq("status", "live");
  if (error) throw error;
  const ids = (live ?? []).map((row) => row.id as string);
  let checkedIntoNext = false;
  if (nextOccurrenceId && ids.includes(nextOccurrenceId)) {
    const { data, error: mineError } = await admin
      .from("community_checkins")
      .select("id")
      .eq("occurrence_id", nextOccurrenceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (mineError) throw mineError;
    checkedIntoNext = Boolean(data);
  }
  return { anyLive: ids.length > 0, checkedIntoNext };
}

export async function memberNeedsLiveCheckIn(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data: live, error } = await admin.from("community_session_occurrences").select("id").eq("status", "live");
  if (error) throw error;
  const ids = (live ?? []).map((row) => row.id as string);
  if (ids.length === 0) return false;
  const { data: mine, error: mineError } = await admin
    .from("community_checkins")
    .select("occurrence_id")
    .eq("user_id", userId)
    .in("occurrence_id", ids);
  if (mineError) throw mineError;
  const checked = new Set((mine ?? []).map((row) => row.occurrence_id as string));
  return ids.some((id) => !checked.has(id));
}
