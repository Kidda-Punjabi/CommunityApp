import "server-only";

import { availableActivityKinds, isSeated } from "@/lib/community/breakout";
import { sessionFeedbackStatus } from "@/lib/community/session-feedback";
import { isCommunityStaffUser } from "@/lib/community/test-sessions";
import type { RoomActivityKind } from "@/lib/community/room-activities";
import type { CommunityBand } from "@/lib/community/constants";
import { bandForLevel } from "@/lib/community/levels";
import type { SupabaseClient } from "@supabase/supabase-js";

export type HostStep = "checkin" | "rooms" | "running" | "wrap";

export type HostPerson = { userId: string; name: string; level: number };

export type HostCheckin = HostPerson & { time: string; isLate: boolean; added: boolean };

export type HostActivity = {
  id: string;
  position: number;
  title: string;
  kind: string;
  status: string;
};

export type HostRoom = {
  id: string;
  roomNumber: number;
  band: CommunityBand;
  status: string;
  members: (HostPerson & { pending: boolean })[];
  activities: HostActivity[];
  /** Sign-offs on the active activity, out of the members seated in the room. */
  signoff: { done: number; of: number; waitingFor: string[] } | null;
};

export type HostSessionView = {
  occurrenceId: string;
  sessionTitle: string;
  isTest: boolean;
  status: string;
  startsAt: string;
  startedAt: string | null;
  week: number;
  topic: string | null;
  checkinCode: string | null;
  checkins: HostCheckin[];
  missing: HostPerson[];
  rooms: HostRoom[];
  /** The step the session is actually at, from its data. */
  autoStep: HostStep;
  /** Set once the host brought everyone back to the main call. */
  mainRoomAt: string | null;
  groupGame: { gameRoomId: string; joinCode: string; gameType: string } | null;
  /** Activity kinds this week's content supports, for the add / change picker. */
  availableKinds: RoomActivityKind[];
  /** End-of-session feedback: who has sent the form. Not offered for test sessions. */
  feedback: { available: boolean; sent: { name: string; notion: boolean; scores: string }[]; notSent: string[] };
};

type Profile = { full_name: string | null; kidda_level: number | null };

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function person(userId: string, profile: Profile | null): HostPerson {
  return { userId, name: profile?.full_name || "Member", level: profile?.kidda_level ?? 0 };
}

export async function loadHostSession(admin: SupabaseClient, occurrenceId: string): Promise<HostSessionView | null> {
  const { data: occurrence, error } = await admin
    .from("community_session_occurrences")
    .select(
      "id, session_id, status, starts_at, started_at, checkin_code, week_number, week_number_override, main_room_at, group_game, google_event_id, community_sessions(title, is_active), lessons:topic_lesson_id(title)"
    )
    .eq("id", occurrenceId)
    .maybeSingle();
  if (error) throw error;
  if (!occurrence) return null;

  const session = one(occurrence.community_sessions as { title: string; is_active: boolean } | { title: string; is_active: boolean }[] | null);
  const lesson = one(occurrence.lessons as { title: string | null } | { title: string | null }[] | null);
  const status = occurrence.status as string;

  const [{ data: checkinRows, error: checkinError }, { data: roomRows, error: roomError }] = await Promise.all([
    admin
      .from("community_checkins")
      .select("user_id, checked_in_at, is_late, added_by_tutor, profiles(full_name, kidda_level)")
      .eq("occurrence_id", occurrenceId)
      .order("checked_in_at"),
    admin
      .from("community_rooms")
      .select("id, room_number, band, status, approved_at")
      .eq("occurrence_id", occurrenceId)
      .order("room_number"),
  ]);
  if (checkinError) throw checkinError;
  if (roomError && roomError.code !== "42P01" && roomError.code !== "PGRST205") throw roomError;

  const checkins: HostCheckin[] = (checkinRows ?? []).map((row) => ({
    ...person(row.user_id as string, one(row.profiles as Profile | Profile[] | null)),
    time: new Date(row.checked_in_at as string).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
    }),
    isLate: Boolean(row.is_late),
    added: Boolean(row.added_by_tutor),
  }));
  const checkedIds = new Set(checkins.map((row) => row.userId));

  // Rooms: closed rooms only matter once the session has ended (for the wrap-up).
  const visibleRooms = (roomRows ?? []).filter(
    (room) => status === "ended" || Boolean(occurrence.main_room_at) || room.status !== "closed"
  );
  const roomIds = visibleRooms.map((room) => room.id as string);
  const [{ data: memberRows }, { data: activityRows }] = roomIds.length
    ? await Promise.all([
        admin
          .from("community_room_members")
          .select("room_id, user_id, assigned_by, assigned_at, profiles(full_name, kidda_level)")
          .in("room_id", roomIds),
        admin
          .from("community_room_activities")
          .select("id, room_id, position, kind, title, status")
          .in("room_id", roomIds)
          .order("position"),
      ])
    : [{ data: [] }, { data: [] }];
  const activeIds = (activityRows ?? []).filter((row) => row.status === "active").map((row) => row.id as string);
  const { data: signoffRows } = activeIds.length
    ? await admin.from("community_room_signoffs").select("activity_id, user_id").in("activity_id", activeIds)
    : { data: [] as { activity_id: string; user_id: string }[] };

  const rooms: HostRoom[] = visibleRooms.map((room) => {
    const members = (memberRows ?? []).filter((row) => row.room_id === room.id);
    const activities: HostActivity[] = (activityRows ?? [])
      .filter((row) => row.room_id === room.id)
      .map((row) => ({
        id: row.id as string,
        position: row.position as number,
        title: (row.title as string) || (row.kind as string),
        kind: row.kind as string,
        status: row.status as string,
      }));
    const active = activities.find((item) => item.status === "active");
    const seated = members.filter((member) => isSeated(member, room));
    let signoff: HostRoom["signoff"] = null;
    if (active) {
      const signed = new Set((signoffRows ?? []).filter((row) => row.activity_id === active.id).map((row) => row.user_id as string));
      signoff = {
        done: seated.filter((member) => signed.has(member.user_id as string)).length,
        of: seated.length,
        waitingFor: seated
          .filter((member) => !signed.has(member.user_id as string))
          .map((member) => (one(member.profiles as Profile | Profile[] | null)?.full_name || "Member").split(" ")[0]),
      };
    }
    return {
      id: room.id as string,
      roomNumber: room.room_number as number,
      band: room.band as CommunityBand,
      status: room.status as string,
      activities,
      signoff,
      members: members.map((member) => ({
        ...person(member.user_id as string, one(member.profiles as Profile | Profile[] | null)),
        pending:
          room.status === "approved" &&
          member.assigned_by === "auto" &&
          Boolean(room.approved_at) &&
          (member.assigned_at as string) > (room.approved_at as string),
      })),
    };
  });

  // Not here yet: main-session members and pod members of this session who haven't checked in.
  const sessionId = occurrence.session_id as string;
  const [{ data: mains }, { data: pods }] = await Promise.all([
    admin.from("community_memberships_meta").select("user_id, profiles(full_name, kidda_level)").eq("main_session_id", sessionId),
    admin.from("pods").select("pod_members(user_id, profiles(full_name, kidda_level))").eq("session_id", sessionId),
  ]);
  const missingMap = new Map<string, HostPerson>();
  for (const row of mains ?? []) {
    const id = row.user_id as string;
    if (!checkedIds.has(id)) missingMap.set(id, person(id, one(row.profiles as Profile | Profile[] | null)));
  }
  for (const pod of pods ?? []) {
    for (const member of (pod.pod_members ?? []) as { user_id: string; profiles: Profile | Profile[] | null }[]) {
      if (!checkedIds.has(member.user_id)) missingMap.set(member.user_id, person(member.user_id, one(member.profiles)));
    }
  }

  const openRooms = rooms.filter((room) => room.status !== "closed");
  const mainRoomAt = (occurrence.main_room_at as string | null) ?? null;
  const game = occurrence.group_game as { gameRoomId?: string; joinCode?: string; gameType?: string } | null;
  let autoStep: HostStep = "checkin";
  if (status === "ended" || mainRoomAt) autoStep = "wrap";
  else if (openRooms.some((room) => room.status === "approved")) autoStep = "running";
  else if (openRooms.length > 0) autoStep = "rooms";

  return {
    occurrenceId,
    sessionTitle: session?.title ?? "Community",
    isTest: session?.is_active === false,
    status,
    startsAt: occurrence.starts_at as string,
    startedAt: (occurrence.started_at as string | null) ?? null,
    week: (occurrence.week_number_override as number | null) ?? (occurrence.week_number as number),
    topic: lesson?.title ?? null,
    checkinCode: (occurrence.checkin_code as string | null) ?? null,
    checkins,
    missing: [...missingMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    rooms,
    autoStep,
    mainRoomAt,
    groupGame:
      game?.gameRoomId && game.joinCode ? { gameRoomId: game.gameRoomId, joinCode: game.joinCode, gameType: game.gameType ?? "point_race" } : null,
    availableKinds: status === "live" ? await availableActivityKinds(admin, occurrenceId) : [],
    feedback:
      status === "ended"
        ? await sessionFeedbackStatus(
            admin,
            { google_event_id: (occurrence.google_event_id as string | null) ?? null, isTest: session?.is_active === false },
            await membersOnly(admin, checkins.map((row) => ({ userId: row.userId, name: row.name })))
          )
        : { available: session?.is_active !== false, sent: [], notSent: [] },
  };
}

export function bandOfPerson(level: number): CommunityBand {
  return bandForLevel(level);
}


/** Leaves out hosts and admins, who don't give feedback on their own sessions. */
async function membersOnly<T extends { userId: string }>(admin: SupabaseClient, people: T[]): Promise<T[]> {
  const flags = await Promise.all(people.map((person) => isCommunityStaffUser(admin, person.userId)));
  return people.filter((_, index) => !flags[index]);
}
