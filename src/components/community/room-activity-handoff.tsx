"use client";

import { markActivityDone } from "@/app/dashboard/community/breakout-actions";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** When an in-app activity was opened from a room, sign it off and go back. */
export function RoomActivityHandoff({ done }: { done: boolean }) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (!done || started.current) return;
    const activityId = new URLSearchParams(window.location.search).get("roomActivity");
    if (!activityId) return;
    started.current = true;
    void markActivityDone(activityId).finally(() => {
      router.replace("/dashboard/community");
    });
  }, [done, router]);

  return null;
}
