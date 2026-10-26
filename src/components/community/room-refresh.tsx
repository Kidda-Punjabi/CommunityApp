"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type CommunityLiveSyncProps = {
  channelId: string;
  occurrenceId?: string | null;
  occurrenceIds?: string[];
  roomId?: string | null;
  activityId?: string | null;
  /** Keep refreshing while the member is still waiting to be seated. */
  poll?: boolean;
};

const FALLBACK_MS = 5000;

export function CommunityLiveSync({
  channelId,
  occurrenceId,
  occurrenceIds,
  roomId,
  activityId,
  poll = false,
}: CommunityLiveSyncProps) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let pollTimer: number | undefined;
    const refresh = () => router.refresh();
    const startPoll = () => {
      if (pollTimer != null) return;
      pollTimer = window.setInterval(refresh, FALLBACK_MS);
    };
    const stopPoll = () => {
      if (pollTimer == null) return;
      window.clearInterval(pollTimer);
      pollTimer = undefined;
    };

    let channel = supabase.channel(`community-live:${channelId}`);
    const listen = (table: string, filter?: string) => {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        refresh
      );
    };

    const occurrences = [...new Set([occurrenceId, ...(occurrenceIds ?? [])].filter((id): id is string => Boolean(id)))];
    for (const id of occurrences) {
      listen("community_session_occurrences", `id=eq.${id}`);
      listen("community_checkins", `occurrence_id=eq.${id}`);
      listen("community_rooms", `occurrence_id=eq.${id}`);
      listen("community_room_members", `occurrence_id=eq.${id}`);
    }
    if (roomId) {
      listen("community_room_activities", `room_id=eq.${roomId}`);
      listen("community_room_members", `room_id=eq.${roomId}`);
    }
    if (activityId) {
      listen("community_room_signoffs", `activity_id=eq.${activityId}`);
      listen("community_debate_votes", `activity_id=eq.${activityId}`);
    }

    if (poll) startPoll();

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        if (!poll) stopPoll();
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        startPoll();
      }
    });

    return () => {
      stopPoll();
      void supabase.removeChannel(channel);
    };
  }, [activityId, channelId, occurrenceId, occurrenceIds, poll, roomId, router]);

  return null;
}

/** @deprecated Use CommunityLiveSync. Kept so older imports still refresh the room. */
export function RoomRefresh({ channelId }: { channelId: string }) {
  return <CommunityLiveSync channelId={channelId} occurrenceId={channelId} />;
}
