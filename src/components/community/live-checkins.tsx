"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LiveCheckins({ occurrenceId }: { occurrenceId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`community-checkins:${occurrenceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "community_checkins",
          filter: `occurrence_id=eq.${occurrenceId}`,
        },
        () => router.refresh()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [occurrenceId, router]);
  return null;
}
