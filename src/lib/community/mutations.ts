import "server-only";

import { randomInt } from "node:crypto";
import { makeCheckinCode } from "@/lib/community/checkin-code";
import { choosePod, type OpenPod } from "@/lib/community/pods";
import { currentStreak, type StreakOccurrence } from "@/lib/community/streak";
import { insertRoutedNotifications } from "@/lib/notifications/insert-notifications";
import type { CommunityBand } from "@/lib/community/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function chooseMainSession(admin: SupabaseClient, userId: string, sessionId: string) {
  const { data: session, error } = await admin.from("community_sessions").select("id").eq("id", sessionId).maybeSingle();
  if (error) throw error;
  if (!session) return { error: "That session is not available." };
  const { data: existing, error: existingError } = await admin
    .from("community_memberships_meta")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    const { error: updateError } = await admin
      .from("community_memberships_meta")
      .update({ main_session_id: sessionId })
      .eq("user_id", userId);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await admin.from("community_memberships_meta").insert({
      user_id: userId,
      main_session_id: sessionId,
    });
    if (insertError) throw insertError;
  }
  return { ok: true };
}

export async function assignMemberPod(admin: SupabaseClient, userId: string) {
  const [{ data: meta, error: metaError }, { data: profile, error: profileError }] = await Promise.all([
    admin.from("community_memberships_meta").select("main_session_id, pod_id").eq("user_id", userId).maybeSingle(),
    admin.from("profiles").select("kidda_level").eq("id", userId).maybeSingle(),
  ]);
  if (metaError) throw metaError;
  if (profileError) throw profileError;
  if (!meta?.main_session_id || profile?.kidda_level == null) {
    return { error: "Pick a session and finish the level test first." };
  }

  const { data: session, error: sessionError } = await admin
    .from("community_sessions")
    .select("weekday_label")
    .eq("id", meta.main_session_id)
    .maybeSingle();
  if (sessionError) throw sessionError;

  const { data: podRows, error: podsError } = await admin
    .from("pods")
    .select("id, band, min_level, max_level, name, max_size, pod_members(user_id)")
    .eq("session_id", meta.main_session_id);
  if (podsError) throw podsError;

  const open: OpenPod[] = (podRows ?? []).map((pod) => ({
    id: pod.id as string,
    band: pod.band as CommunityBand,
    minLevel: pod.min_level as number,
    maxLevel: pod.max_level as number,
    memberCount: Array.isArray(pod.pod_members) ? pod.pod_members.length : 0,
    maxSize: (pod.max_size as number) ?? 8,
    name: pod.name as string,
  }));

  const choice = choosePod(open, profile.kidda_level, session?.weekday_label ?? "Community");
  let podId: string;
  if (choice.kind === "create") {
    const { data: created, error: createError } = await admin
      .from("pods")
      .insert({
        session_id: meta.main_session_id,
        band: choice.band,
        min_level: choice.minLevel,
        max_level: choice.maxLevel,
        name: choice.name,
      })
      .select("id, name")
      .single();
    if (createError) throw createError;
    podId = created.id;
  } else {
    podId = choice.podId;
    const { error: rangeError } = await admin
      .from("pods")
      .update({ min_level: choice.minLevel, max_level: choice.maxLevel })
      .eq("id", podId);
    if (rangeError) throw rangeError;
  }

  if (meta.pod_id && meta.pod_id !== podId) {
    await admin.from("pod_members").delete().eq("user_id", userId);
  }
  const { error: memberError } = await admin.from("pod_members").upsert(
    { pod_id: podId, user_id: userId },
    { onConflict: "user_id" }
  );
  if (memberError) throw memberError;
  const { error: metaWriteError } = await admin
    .from("community_memberships_meta")
    .update({ pod_id: podId })
    .eq("user_id", userId);
  if (metaWriteError) throw metaWriteError;

  const { data: named } = await admin.from("pods").select("name").eq("id", podId).maybeSingle();
  return { ok: true, podId, name: named?.name ?? "Your pod" };
}

async function sessionAudience(admin: SupabaseClient, sessionId: string): Promise<string[]> {
  const [{ data: mains }, { data: pods }] = await Promise.all([
    admin.from("community_memberships_meta").select("user_id").eq("main_session_id", sessionId),
    admin.from("pods").select("id").eq("session_id", sessionId),
  ]);
  const ids = new Set((mains ?? []).map((row) => row.user_id as string));
  const podIds = (pods ?? []).map((pod) => pod.id as string);
  if (podIds.length > 0) {
    const { data: members } = await admin.from("pod_members").select("user_id").in("pod_id", podIds);
    for (const member of members ?? []) ids.add(member.user_id as string);
  }
  return [...ids];
}

export async function startCommunitySession(admin: SupabaseClient, actorId: string, occurrenceId: string) {
  const { data: occurrence, error } = await admin
    .from("community_session_occurrences")
    .select("id, session_id, status, community_sessions(title)")
    .eq("id", occurrenceId)
    .maybeSingle();
  if (error) throw error;
  if (!occurrence) return { error: "Session not found." };
  if (occurrence.status === "ended" || occurrence.status === "cancelled") {
    return { error: "This session has already finished." };
  }
  const code = makeCheckinCode(() => randomInt(0, 256));
  const { error: updateError } = await admin
    .from("community_session_occurrences")
    .update({
      status: "live",
      checkin_code: code,
      started_by: actorId,
      started_at: new Date().toISOString(),
    })
    .eq("id", occurrenceId);
  if (updateError) throw updateError;

  const session = Array.isArray(occurrence.community_sessions)
    ? occurrence.community_sessions[0]
    : occurrence.community_sessions;
  const sessionName = session?.title ?? "Community";
  const userIds = await sessionAudience(admin, occurrence.session_id as string);
  for (const userId of userIds) {
    await insertRoutedNotifications(admin, {
      type: "community_session_live",
      userId,
      actorUserId: actorId,
      payload: {
        title: `${sessionName} is live`,
        occurrence_id: occurrenceId,
        session_name: sessionName,
        url: `/dashboard/community/check-in?occurrence=${occurrenceId}`,
      },
    });
  }
  return { ok: true, code };
}

export async function endCommunitySession(admin: SupabaseClient, occurrenceId: string) {
  const { error } = await admin
    .from("community_session_occurrences")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", occurrenceId);
  if (error) throw error;
  return { ok: true };
}

export async function setOccurrenceWeek(admin: SupabaseClient, occurrenceId: string, week: number) {
  if (week < 1 || week > 24) return { error: "Week must be from 1 to 24." };
  const { data: lesson, error: lessonError } = await admin
    .from("lessons")
    .select("id")
    .eq("course_id", "22f0e217-92a7-46f0-b38e-651409d7d118")
    .eq("lesson_number", week)
    .maybeSingle();
  if (lessonError) throw lessonError;
  const { error } = await admin
    .from("community_session_occurrences")
    .update({ week_number_override: week, topic_lesson_id: lesson?.id ?? null })
    .eq("id", occurrenceId);
  if (error) throw error;
  return { ok: true };
}

export async function checkInMember(
  admin: SupabaseClient,
  userId: string,
  occurrenceId: string,
  code: string,
  addedByTutor = false
) {
  const { data: occurrence, error } = await admin
    .from("community_session_occurrences")
    .select("id, session_id, status, checkin_code, late_after, starts_at, ends_at")
    .eq("id", occurrenceId)
    .maybeSingle();
  if (error) throw error;
  if (!occurrence || occurrence.status !== "live") return { error: "Check-in is only open while the session is live." };
  if (!addedByTutor && occurrence.checkin_code?.toUpperCase() !== code.trim().toUpperCase()) {
    return { error: "That code doesn't match." };
  }

  const checkedInAt = new Date();
  const isLate = occurrence.late_after ? checkedInAt.getTime() >= Date.parse(occurrence.late_after) : false;
  const { error: insertError } = await admin.from("community_checkins").upsert(
    {
      occurrence_id: occurrenceId,
      user_id: userId,
      checked_in_at: checkedInAt.toISOString(),
      is_late: isLate,
      added_by_tutor: addedByTutor,
    },
    { onConflict: "occurrence_id,user_id" }
  );
  if (insertError) throw insertError;

  const { data: meta } = await admin
    .from("community_memberships_meta")
    .select("main_session_id, community_sessions(first_starts_on, weekday_label)")
    .eq("user_id", userId)
    .maybeSingle();
  const mainSessionId = meta?.main_session_id as string | null;
  const isMain = mainSessionId === occurrence.session_id;
  let streak = 0;
  if (isMain && mainSessionId) {
    const { data: past } = await admin
      .from("community_session_occurrences")
      .select("starts_at, ends_at, community_checkins(user_id)")
      .eq("session_id", mainSessionId)
      .lte("ends_at", occurrence.ends_at)
      .neq("status", "cancelled");
    const rows: StreakOccurrence[] = (past ?? []).map((row) => ({
      startsAt: row.starts_at as string,
      endsAt: row.ends_at as string,
      attended: ((row.community_checkins ?? []) as { user_id: string }[]).some((checkin) => checkin.user_id === userId) || row.starts_at === occurrence.starts_at,
    }));
    const session = Array.isArray(meta?.community_sessions) ? meta?.community_sessions[0] : meta?.community_sessions;
    streak = currentStreak(rows, session?.first_starts_on ?? null, checkedInAt);
  }

  return { ok: true, isLate, streak, countsForStreak: isMain };
}
