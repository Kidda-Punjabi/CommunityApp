"use client";

import { useEffect, useRef, useTransition, type MutableRefObject } from "react";
import { BUZZ_RACE_ANSWER_WINDOW_MS, BUZZ_RACE_BUZZ_WINDOW_MS } from "@/lib/group-games/buzz-race-constants";

type UseBuzzRaceTimeoutOptions = {
  itemId: string | null;
  openedAt: string | null;
  buzzedAt: string | null;
  buzzedBy: string | null;
  resolvedAt: string | null;
  enabled: boolean;
  onTimeout: (itemId: string) => Promise<void>;
};

export function useBuzzRaceTimeout({
  itemId,
  openedAt,
  buzzedAt,
  buzzedBy,
  resolvedAt,
  enabled,
  onTimeout,
}: UseBuzzRaceTimeoutOptions) {
  const timeoutCalledRef = useRef(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    timeoutCalledRef.current = false;
  }, [itemId]);

  useEffect(() => {
    if (!enabled || !itemId || resolvedAt) return;

    const deadline =
      buzzedBy && buzzedAt
        ? new Date(buzzedAt).getTime() + BUZZ_RACE_ANSWER_WINDOW_MS
        : openedAt
          ? new Date(openedAt).getTime() + BUZZ_RACE_BUZZ_WINDOW_MS
          : null;

    if (!deadline) return;

    const msLeft = deadline - Date.now();
    const fire = () => {
      if (timeoutCalledRef.current) return;
      timeoutCalledRef.current = true;
      startTransition(async () => {
        await onTimeout(itemId);
      });
    };

    if (msLeft <= 0) {
      fire();
      return;
    }

    const timer = window.setTimeout(fire, msLeft + 50);
    return () => window.clearTimeout(timer);
  }, [itemId, openedAt, buzzedAt, buzzedBy, resolvedAt, enabled, onTimeout]);
}

export function markBuzzRaceTimeoutCalled(ref: MutableRefObject<boolean>) {
  ref.current = true;
}
