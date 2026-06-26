"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { shouldAutoSyncCalendar } from "@/lib/calendar/auto-sync";

type TutorCalendarAutoSyncProps = {
  connected: boolean;
  lastSyncedAt: string | null | undefined;
};

export function TutorCalendarAutoSync({ connected, lastSyncedAt }: TutorCalendarAutoSyncProps) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (!connected || started.current) return;
    if (!shouldAutoSyncCalendar(lastSyncedAt)) return;

    started.current = true;

    void (async () => {
      try {
        const res = await fetch("/api/google/calendar/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forceFullSync: false }),
        });
        if (res.ok) {
          router.refresh();
        }
      } catch {
        // silent — manual sync still available
      }
    })();
  }, [connected, lastSyncedAt, router]);

  return null;
}
