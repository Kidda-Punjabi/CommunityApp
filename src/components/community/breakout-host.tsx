import { BreakoutHostView, type HostRoomCard } from "@/components/community/breakout-host-view";
import { isSeated } from "@/lib/community/breakout";
import type { CommunityBand } from "@/lib/community/constants";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";

export async function BreakoutHost({ occurrenceId }: { occurrenceId: string }) {
  const admin = createServiceRoleClient();
  const { data: rooms, error } = await admin
    .from("community_rooms")
    .select("id, room_number, band, status, approved_at")
    .eq("occurrence_id", occurrenceId)
    .neq("status", "closed")
    .order("room_number");
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return null;
    throw error;
  }
  const cards: HostRoomCard[] = [];
  for (const room of rooms ?? []) {
    const { data: members } = await admin
      .from("community_room_members")
      .select("user_id, assigned_by, assigned_at, profiles(full_name, kidda_level)")
      .eq("room_id", room.id);
    const { data: activities } = await admin
      .from("community_room_activities")
      .select("id, position, status")
      .eq("room_id", room.id)
      .order("position");
    const active = (activities ?? []).find((item) => item.status === "active");
    const seated = (members ?? []).filter((member) => isSeated(member, room));
    const { count } = active
      ? await admin
          .from("community_room_signoffs")
          .select("user_id", { count: "exact", head: true })
          .eq("activity_id", active.id)
      : { count: 0 };
    cards.push({
      id: room.id as string,
      roomNumber: room.room_number as number,
      band: room.band as CommunityBand,
      status: room.status as string,
      progress: active
        ? `Activity ${(active.position as number) + 1} of ${(activities ?? []).length} · ${count ?? 0}/${seated.length} done`
        : null,
      members: (members ?? []).map((member) => {
        const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
        const pending = room.status === "approved" && member.assigned_by === "auto" && Boolean(room.approved_at) && member.assigned_at > room.approved_at;
        return {
          userId: member.user_id as string,
          name: profile?.full_name || "Member",
          level: profile?.kidda_level ?? 0,
          pending,
        };
      }),
    });
  }
  return <BreakoutHostView occurrenceId={occurrenceId} rooms={cards} />;
}
