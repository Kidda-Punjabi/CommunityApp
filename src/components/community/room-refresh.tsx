"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const TABLES = [
  "community_rooms",
  "community_room_members",
  "community_room_activities",
  "community_room_signoffs",
  "community_debate_votes",
  "community_checkins",
  "game_rooms",
] as const;

export function RoomRefresh({ channelId }: { channelId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let channel = supabase.channel(`community-breakout:${channelId}`);
    for (const table of TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => router.refresh()
      );
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelId, router]);

  return null;
}
