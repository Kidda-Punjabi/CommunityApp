import "server-only";

import type { CommunityBand } from "@/lib/community/constants";
import { planBreakoutRooms, suggestLateRoom, type RoomPerson } from "@/lib/community/breakout-rooms";
import { pickDebateId, planRoomActivities, type DebatePick, type TopicOffer } from "@/lib/community/room-activities";
import type { SupabaseClient } from "@supabase/supabase-js";

const COURSE_ID = "22f0e217-92a7-46f0-b38e-651409d7d118";

async function settleCompletedRace<T extends { id: string; position: number; kind: string; status: string; payload: unknown; room_id?: string }>(
  admin: SupabaseClient,
  activities: T[]
): Promise<T[]> {
  const active = activities.find((item) => item.status === "active" && item.kind === "point_race");
  const gameRoomId = (active?.payload as { gameRoomId?: string | null } | null)?.gameRoomId;
  if (!active || !gameRoomId) return activities;
  const { data: game } = await admin.from("game_rooms").select("status").eq("id", gameRoomId).maybeSingle();
  if (game?.status !== "completed") return activities;
  const now = new Date().toISOString();
  await admin.from("community_room_activities").update({ status: "done", completed_at: now }).eq("id", active.id);
  const next = activities.find((item) => item.position === active.position + 1 && item.status === "locked");
  if (next) {
    await admin.from("community_room_activities").update({ status: "active", unlocked_at: now }).eq("id", next.id);
  }
  return activities.map((item) => {
    if (item.id === active.id) return { ...item, status: "done" };
    if (next && item.id === next.id) return { ...item, status: "active" };
    return item;
  });
}

export function firstName(fullName: string | null | undefined): string {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) return "Friend";
  return trimmed.split(/\s+/)[0] ?? "Friend";
}

export function isSeated(
  member: { assigned_by: string; assigned_at: string },
  room: { status: string; approved_at: string | null }
): boolean {
  if (room.status !== "approved") return false;
  if (member.assigned_by === "host") return true;
  if (!room.approved_at) return false;
  return member.assigned_at <= room.approved_at;
}

async function peopleFor(admin: SupabaseClient, occurrenceId: string): Promise<RoomPerson[]> {
  const { data: checkins, error } = await admin
    .from("community_checkins")
    .select("user_id, profiles(kidda_level)")
    .eq("occurrence_id", occurrenceId);
  if (error) throw error;
  const ids = (checkins ?? []).map((row) => row.user_id as string);
  const pods = new Map<string, string>();
  if (ids.length > 0) {
    const { data: memberships, error: podError } = await admin
      .from("pod_members")
      .select("user_id, pod_id")
      .in("user_id", ids);
    if (podError) throw podError;
    for (const row of memberships ?? []) pods.set(row.user_id as string, row.pod_id as string);
  }
  return (checkins ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      userId: row.user_id as string,
      level: profile?.kidda_level ?? 0,
      podId: pods.get(row.user_id as string) ?? null,
    };
  });
}

export async function topicFor(admin: SupabaseClient, occurrenceId: string): Promise<TopicOffer> {
  const { data: occurrence, error } = await admin
    .from("community_session_occurrences")
    .select("topic_lesson_id, week_number, week_number_override")
    .eq("id", occurrenceId)
    .maybeSingle();
  if (error) throw error;
  const week = occurrence?.week_number_override ?? occurrence?.week_number ?? null;
  let lessonId = (occurrence?.topic_lesson_id as string | null) ?? null;
  if (!lessonId && week) {
    const { data: lesson } = await admin
      .from("lessons")
      .select("id")
      .eq("course_id", COURSE_ID)
      .eq("lesson_number", week)
      .maybeSingle();
    lessonId = (lesson?.id as string | null) ?? null;
  }
  const empty: TopicOffer = {
    lessonId,
    deckName: null,
    deckId: null,
    topicTags: [],
    quizId: null,
    quizTitle: null,
    speakingPromptCount: 0,
  };
  if (!lessonId) return empty;
  const { data: cards, error: cardError } = await admin
    .from("flashcards")
    .select("deck_name, deck_id, topic_tags, back_text")
    .eq("lesson_id", lessonId)
    .like("deck_name", "%(Community)")
    .not("deck_name", "like", "Old -%");
  if (cardError) throw cardError;
  const tags = new Set<string>();
  let frames = 0;
  for (const card of cards ?? []) {
    if (typeof card.back_text === "string" && card.back_text.includes("___")) frames += 1;
    for (const tag of (card.topic_tags ?? []) as string[]) tags.add(tag);
  }
  const first = cards?.[0];
  const { data: quiz } = await admin
    .from("quizzes")
    .select("id, title")
    .eq("lesson_id", lessonId)
    .limit(1)
    .maybeSingle();
  return {
    lessonId,
    deckName: (first?.deck_name as string | null) ?? null,
    deckId: (first?.deck_id as string | null) ?? null,
    topicTags: [...tags],
    quizId: (quiz?.id as string | null) ?? null,
    quizTitle: (quiz?.title as string | null) ?? null,
    speakingPromptCount: frames,
  };
}

async function freshDebate(admin: SupabaseClient, roomId: string, userIds: string[]): Promise<DebatePick | null> {
  const { data: debates, error } = await admin
    .from("community_debates")
    .select("id, prompt, option_a, option_b, prompt_pa, romanised")
    .eq("is_active", true);
  if (error) throw error;
  const all = debates ?? [];
  if (all.length === 0) return null;
  let seen = new Set<string>();
  if (userIds.length > 0) {
    const { data: past } = await admin
      .from("community_room_members")
      .select("occurrence_id")
      .in("user_id", userIds);
    const occurrenceIds = [...new Set((past ?? []).map((row) => row.occurrence_id as string))];
    const { data: recentOccurrences } = occurrenceIds.length
      ? await admin
          .from("community_session_occurrences")
          .select("id, starts_at")
          .in("id", occurrenceIds)
          .order("starts_at", { ascending: false })
          .limit(5)
      : { data: [] };
    const recentIds = (recentOccurrences ?? []).map((row) => row.id as string);
    if (recentIds.length > 0) {
      const { data: rooms } = await admin.from("community_rooms").select("id").in("occurrence_id", recentIds);
      const roomIds = (rooms ?? []).map((row) => row.id as string);
      if (roomIds.length > 0) {
        const { data: activities } = await admin
          .from("community_room_activities")
          .select("payload")
          .in("room_id", roomIds)
          .eq("kind", "warmup_debate");
        seen = new Set(
          (activities ?? [])
            .map((row) => (row.payload as { debateId?: string } | null)?.debateId)
            .filter((id): id is string => Boolean(id))
        );
      }
    }
  }
  const unused = all.filter((row) => !seen.has(row.id as string));
  const pool = unused.length > 0 ? unused : all;
  const id = pickDebateId(roomId, pool.map((row) => row.id as string));
  const chosen = pool.find((row) => row.id === id) ?? pool[0];
  return {
    id: chosen.id as string,
    prompt: chosen.prompt as string,
    optionA: chosen.option_a as string,
    optionB: chosen.option_b as string,
    promptPa: (chosen.prompt_pa as string | null) ?? null,
    romanised: (chosen.romanised as string | null) ?? null,
  };
}

async function insertPlan(
  admin: SupabaseClient,
  roomId: string,
  band: CommunityBand,
  userIds: string[],
  topic: TopicOffer
) {
  const debate = await freshDebate(admin, roomId, userIds);
  if (!debate) return;
  const plan = planRoomActivities({ roomId, band, topic, debate });
  if (topic.lessonId && plan.some((item) => item.kind === "speaking_prompts")) {
    const { data: cards } = await admin
      .from("flashcards")
      .select("id, front_text, back_text")
      .eq("lesson_id", topic.lessonId)
      .like("deck_name", "%(Community)")
      .like("back_text", "%___%")
      .order("id")
      .limit(8);
    const prompts = (cards ?? []).map((card) => ({
      id: card.id as string,
      front: card.front_text as string,
      back: card.back_text as string,
    }));
    for (const item of plan) {
      if (item.kind === "speaking_prompts") item.payload = { ...item.payload, prompts };
    }
  }
  const now = new Date().toISOString();
  const { error } = await admin.from("community_room_activities").insert(
    plan.map((item) => ({
      room_id: roomId,
      position: item.position,
      kind: item.kind,
      title: item.title,
      payload: item.payload,
      status: item.position === 0 ? "active" : "locked",
      unlocked_at: item.position === 0 ? now : null,
    }))
  );
  if (error) throw error;
}

export async function suggestBreakoutRooms(admin: SupabaseClient, occurrenceId: string) {
  const { data: existing, error } = await admin
    .from("community_rooms")
    .select("id, status")
    .eq("occurrence_id", occurrenceId);
  if (error) throw error;
  if ((existing ?? []).some((row) => row.status === "approved" || row.status === "closed")) {
    return { error: "Rooms are already approved." };
  }
  if ((existing ?? []).length > 0) {
    const { error: deleteError } = await admin.from("community_rooms").delete().eq("occurrence_id", occurrenceId);
    if (deleteError) throw deleteError;
  }
  const plan = planBreakoutRooms(await peopleFor(admin, occurrenceId));
  if (plan.length === 0) return { error: "Nobody is checked in yet." };
  for (const room of plan) {
    const { data: created, error: roomError } = await admin
      .from("community_rooms")
      .insert({
        occurrence_id: occurrenceId,
        room_number: room.roomNumber,
        band: room.band,
        status: "suggested",
      })
      .select("id")
      .single();
    if (roomError) throw roomError;
    const { error: memberError } = await admin.from("community_room_members").insert(
      room.userIds.map((userId) => ({
        room_id: created.id,
        user_id: userId,
        assigned_by: "auto",
        occurrence_id: occurrenceId,
      }))
    );
    if (memberError) throw memberError;
  }
  return { ok: true as const, rooms: plan.length };
}

export async function approveBreakoutRooms(admin: SupabaseClient, occurrenceId: string, actorId: string) {
  const { data: rooms, error } = await admin
    .from("community_rooms")
    .select("id, band, status")
    .eq("occurrence_id", occurrenceId)
    .eq("status", "suggested");
  if (error) throw error;
  if (!rooms || rooms.length === 0) return { error: "There are no rooms to approve." };
  const topic = await topicFor(admin, occurrenceId);
  const now = new Date().toISOString();
  for (const room of rooms) {
    const { data: members } = await admin.from("community_room_members").select("user_id").eq("room_id", room.id);
    const { error: updateError } = await admin
      .from("community_rooms")
      .update({ status: "approved", approved_at: now, approved_by: actorId })
      .eq("id", room.id);
    if (updateError) throw updateError;
    await insertPlan(
      admin,
      room.id as string,
      room.band as CommunityBand,
      (members ?? []).map((row) => row.user_id as string),
      topic
    );
  }
  return { ok: true as const };
}

export async function placeLateCheckIn(admin: SupabaseClient, occurrenceId: string, userId: string) {
  const { data: rooms, error } = await admin
    .from("community_rooms")
    .select("id, room_number, band, status")
    .eq("occurrence_id", occurrenceId)
    .eq("status", "approved");
  if (error) throw error;
  if (!rooms || rooms.length === 0) return;
  const { data: already } = await admin
    .from("community_room_members")
    .select("user_id")
    .eq("occurrence_id", occurrenceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (already) return;
  const { data: profile } = await admin.from("profiles").select("kidda_level").eq("id", userId).maybeSingle();
  const counts = await Promise.all(
    rooms.map(async (room) => {
      const { count } = await admin
        .from("community_room_members")
        .select("user_id", { count: "exact", head: true })
        .eq("room_id", room.id);
      return { roomNumber: room.room_number as number, band: room.band as CommunityBand, count: count ?? 0, id: room.id as string };
    })
  );
  const choice = suggestLateRoom({ userId, level: profile?.kidda_level ?? 0, podId: null }, counts);
  if ("roomNumber" in choice) {
    const room = counts.find((item) => item.roomNumber === choice.roomNumber);
    if (!room) return;
    const { error: insertError } = await admin.from("community_room_members").insert({
      room_id: room.id,
      user_id: userId,
      assigned_by: "auto",
      occurrence_id: occurrenceId,
    });
    if (insertError) throw insertError;
    return;
  }
  const nextNumber = Math.max(...counts.map((room) => room.roomNumber)) + 1;
  const { data: created, error: roomError } = await admin
    .from("community_rooms")
    .insert({
      occurrence_id: occurrenceId,
      room_number: nextNumber,
      band: choice.band,
      status: "suggested",
    })
    .select("id")
    .single();
  if (roomError) throw roomError;
  const { error: memberError } = await admin.from("community_room_members").insert({
    room_id: created.id,
    user_id: userId,
    assigned_by: "auto",
    occurrence_id: occurrenceId,
  });
  if (memberError) throw memberError;
}

export async function moveBreakoutMember(
  admin: SupabaseClient,
  occurrenceId: string,
  userId: string,
  target: number | "new"
) {
  const { data: rooms, error } = await admin
    .from("community_rooms")
    .select("id, room_number, band, status, approved_at")
    .eq("occurrence_id", occurrenceId)
    .neq("status", "closed");
  if (error) throw error;
  const { data: profile } = await admin.from("profiles").select("kidda_level").eq("id", userId).maybeSingle();
  const level = profile?.kidda_level ?? 0;
  let roomId: string;
  if (target === "new") {
    const nextNumber = Math.max(0, ...(rooms ?? []).map((room) => room.room_number as number)) + 1;
    const approved = (rooms ?? []).some((room) => room.status === "approved");
    const { data: created, error: roomError } = await admin
      .from("community_rooms")
      .insert({
        occurrence_id: occurrenceId,
        room_number: nextNumber,
        band: level <= 0 ? "sounds" : level <= 3 ? "beginner" : level <= 6 ? "intermediate" : "advanced",
        status: approved ? "approved" : "suggested",
        approved_at: approved ? new Date().toISOString() : null,
      })
      .select("id, band")
      .single();
    if (roomError) throw roomError;
    roomId = created.id as string;
    if (approved) {
      await insertPlan(admin, roomId, created.band as CommunityBand, [userId], await topicFor(admin, occurrenceId));
    }
  } else {
    const room = (rooms ?? []).find((item) => item.room_number === target);
    if (!room) return { error: "That room is not open." };
    roomId = room.id as string;
  }
  const { error: upsertError } = await admin.from("community_room_members").upsert(
    {
      room_id: roomId,
      user_id: userId,
      assigned_by: "host",
      occurrence_id: occurrenceId,
      assigned_at: new Date().toISOString(),
    },
    { onConflict: "occurrence_id,user_id" }
  );
  if (upsertError) throw upsertError;
  return { ok: true as const };
}

export async function approveLateMember(admin: SupabaseClient, occurrenceId: string, userId: string) {
  const { error } = await admin
    .from("community_room_members")
    .update({ assigned_by: "host" })
    .eq("occurrence_id", occurrenceId)
    .eq("user_id", userId);
  if (error) throw error;
  return { ok: true as const };
}

async function unlockNext(admin: SupabaseClient, activityId: string) {
  const { data: activity, error } = await admin
    .from("community_room_activities")
    .select("id, room_id, position, status")
    .eq("id", activityId)
    .maybeSingle();
  if (error) throw error;
  if (!activity || activity.status === "done") return;
  const { data: room } = await admin
    .from("community_rooms")
    .select("id, status, approved_at")
    .eq("id", activity.room_id)
    .maybeSingle();
  const { data: members } = await admin
    .from("community_room_members")
    .select("user_id, assigned_by, assigned_at")
    .eq("room_id", activity.room_id);
  const seated = (members ?? []).filter((member) =>
    isSeated(member, { status: room?.status ?? "", approved_at: room?.approved_at ?? null })
  );
  const { count } = await admin
    .from("community_room_signoffs")
    .select("user_id", { count: "exact", head: true })
    .eq("activity_id", activityId)
    .in(
      "user_id",
      seated.map((member) => member.user_id as string)
    );
  if (seated.length === 0 || (count ?? 0) < seated.length) return;
  const now = new Date().toISOString();
  await admin.from("community_room_activities").update({ status: "done", completed_at: now }).eq("id", activityId);
  const { data: next } = await admin
    .from("community_room_activities")
    .select("id")
    .eq("room_id", activity.room_id)
    .eq("position", (activity.position as number) + 1)
    .maybeSingle();
  if (next) {
    await admin
      .from("community_room_activities")
      .update({ status: "active", unlocked_at: now })
      .eq("id", next.id);
  }
}

export async function skipRoomActivity(admin: SupabaseClient, roomId: string) {
  const { data: current } = await admin
    .from("community_room_activities")
    .select("id, position")
    .eq("room_id", roomId)
    .eq("status", "active")
    .maybeSingle();
  if (!current) return { error: "This room has no open activity." };
  const now = new Date().toISOString();
  await admin.from("community_room_activities").update({ status: "done", completed_at: now }).eq("id", current.id);
  const { data: next } = await admin
    .from("community_room_activities")
    .select("id")
    .eq("room_id", roomId)
    .eq("position", (current.position as number) + 1)
    .maybeSingle();
  if (next) {
    await admin.from("community_room_activities").update({ status: "active", unlocked_at: now }).eq("id", next.id);
  }
  return { ok: true as const };
}

export async function signRoomActivity(admin: SupabaseClient, userId: string, activityId: string) {
  const allowed = await userCanTouch(admin, userId, activityId);
  if (!allowed) return { error: "This activity is not open for you." };
  const { error } = await admin.from("community_room_signoffs").upsert(
    { activity_id: activityId, user_id: userId, signed_at: new Date().toISOString() },
    { onConflict: "activity_id,user_id" }
  );
  if (error) throw error;
  await unlockNext(admin, activityId);
  return { ok: true as const };
}

export async function voteInDebate(admin: SupabaseClient, userId: string, activityId: string, choice: "a" | "b") {
  const allowed = await userCanTouch(admin, userId, activityId);
  if (!allowed) return { error: "This debate is not open for you." };
  const { error } = await admin.from("community_debate_votes").upsert(
    { activity_id: activityId, user_id: userId, choice },
    { onConflict: "activity_id,user_id" }
  );
  if (error) throw error;
  return { ok: true as const };
}

async function userCanTouch(admin: SupabaseClient, userId: string, activityId: string) {
  const { data: activity } = await admin
    .from("community_room_activities")
    .select("room_id, status")
    .eq("id", activityId)
    .maybeSingle();
  if (!activity || activity.status !== "active") return false;
  const { data: member } = await admin
    .from("community_room_members")
    .select("user_id, assigned_by, assigned_at")
    .eq("room_id", activity.room_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return false;
  const { data: room } = await admin
    .from("community_rooms")
    .select("status, approved_at")
    .eq("id", activity.room_id)
    .maybeSingle();
  return isSeated(member, { status: room?.status ?? "", approved_at: room?.approved_at ?? null });
}

export async function closeBreakoutRooms(admin: SupabaseClient, occurrenceId: string) {
  const { error } = await admin
    .from("community_rooms")
    .update({ status: "closed" })
    .eq("occurrence_id", occurrenceId)
    .neq("status", "closed");
  if (error && error.code !== "42P01") throw error;
}

export type MemberRoomView = {
  occurrenceId: string;
  roomId: string | null;
  checkedInCount: number;
  meetUrl: string | null;
  approvedRoomCount: number;
  phase: "waiting" | "room";
  roomNumber: number | null;
  band: CommunityBand | null;
  names: string[];
  people: { userId: string; name: string }[];
  activities: {
    id: string;
    position: number;
    kind: string;
    title: string;
    status: string;
    payload: Record<string, unknown>;
  }[];
  signedUserIds: string[];
  myVote: "a" | "b" | null;
  votes: { userId: string; choice: "a" | "b" }[];
};

export async function loadMemberRoom(admin: SupabaseClient, userId: string): Promise<MemberRoomView | null> {
  const { data: live, error } = await admin
    .from("community_session_occurrences")
    .select("id, meet_url, status")
    .eq("status", "live");
  if (error) throw error;
  const occurrenceIds = (live ?? []).map((row) => row.id as string);
  if (occurrenceIds.length === 0) return null;
  const { data: checkin } = await admin
    .from("community_checkins")
    .select("occurrence_id")
    .eq("user_id", userId)
    .in("occurrence_id", occurrenceIds)
    .limit(1)
    .maybeSingle();
  if (!checkin) return null;
  const occurrenceId = checkin.occurrence_id as string;
  const occurrence = (live ?? []).find((row) => row.id === occurrenceId);
  const [{ count }, { count: approvedRoomCount }] = await Promise.all([
    admin
      .from("community_checkins")
      .select("user_id", { count: "exact", head: true })
      .eq("occurrence_id", occurrenceId),
    admin
      .from("community_rooms")
      .select("id", { count: "exact", head: true })
      .eq("occurrence_id", occurrenceId)
      .eq("status", "approved"),
  ]);
  const { data: membership, error: membershipError } = await admin
    .from("community_room_members")
    .select("room_id, assigned_by, assigned_at")
    .eq("occurrence_id", occurrenceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (membershipError) {
    if (membershipError.code === "42P01" || membershipError.code === "PGRST205") return null;
    throw membershipError;
  }
  const base = {
    occurrenceId,
    roomId: null,
    checkedInCount: count ?? 0,
    meetUrl: (occurrence?.meet_url as string | null) ?? null,
    approvedRoomCount: approvedRoomCount ?? 0,
    phase: "waiting" as const,
    roomNumber: null,
    band: null,
    names: [] as string[],
    people: [] as { userId: string; name: string }[],
    activities: [],
    signedUserIds: [] as string[],
    myVote: null,
    votes: [] as { userId: string; choice: "a" | "b" }[],
  };
  if (!membership) return base;
  const { data: room } = await admin
    .from("community_rooms")
    .select("id, room_number, band, status, approved_at")
    .eq("id", membership.room_id)
    .maybeSingle();
  if (!room || !isSeated(membership, room)) return base;
  const { data: mates } = await admin
    .from("community_room_members")
    .select("user_id, assigned_by, assigned_at, profiles(full_name)")
    .eq("room_id", room.id);
  const seated = (mates ?? []).filter((mate) => isSeated(mate, room));
  const { data: loadedActivities } = await admin
    .from("community_room_activities")
    .select("id, position, kind, title, status, payload")
    .eq("room_id", room.id)
    .order("position");
  let activities = await settleCompletedRace(admin, loadedActivities ?? []);
  let active = activities.find((item) => item.status === "active");
  let { data: signoffs } = active
    ? await admin.from("community_room_signoffs").select("user_id").eq("activity_id", active.id)
    : { data: [] as { user_id: string }[] };
  if (active && seated.length > 0 && (signoffs ?? []).length >= seated.length) {
    await unlockNext(admin, active.id as string);
    const { data: refreshed } = await admin
      .from("community_room_activities")
      .select("id, position, kind, title, status, payload")
      .eq("room_id", room.id)
      .order("position");
    activities = refreshed ?? activities;
    active = activities.find((item) => item.status === "active");
    const nextSignoffs = active
      ? await admin.from("community_room_signoffs").select("user_id").eq("activity_id", active.id)
      : { data: [] as { user_id: string }[] };
    signoffs = nextSignoffs.data;
  }
  const { data: votes } = active
    ? await admin.from("community_debate_votes").select("user_id, choice").eq("activity_id", active.id)
    : { data: [] };
  const mine = (votes ?? []).find((vote) => vote.user_id === userId);
  return {
    ...base,
    phase: "room",
    roomId: room.id as string,
    roomNumber: room.room_number as number,
    band: room.band as CommunityBand,
    names: seated.map((mate) => {
      const profile = Array.isArray(mate.profiles) ? mate.profiles[0] : mate.profiles;
      return firstName(profile?.full_name);
    }),
    people: seated.map((mate) => {
      const profile = Array.isArray(mate.profiles) ? mate.profiles[0] : mate.profiles;
      return { userId: mate.user_id as string, name: firstName(profile?.full_name) };
    }),
    activities: (activities ?? []).map((item) => ({
      id: item.id as string,
      position: item.position as number,
      kind: item.kind as string,
      title: item.title as string,
      status: item.status as string,
      payload: (item.payload ?? {}) as Record<string, unknown>,
    })),
    signedUserIds: (signoffs ?? []).map((row) => row.user_id as string),
    myVote: (mine?.choice as "a" | "b" | undefined) ?? null,
    votes: (votes ?? []).map((vote) => ({ userId: vote.user_id as string, choice: vote.choice as "a" | "b" })),
  };
}
