"use client";

import { useEffect, useState } from "react";
import { POINTS_EARNED_EVENT } from "@/lib/points/notify-points-earned";

type Toast = {
  id: number;
  points: number;
};

export function PointsToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    function handlePointsEarned(event: Event) {
      const points = (event as CustomEvent<number>).detail;
      if (!points || points <= 0) return;

      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, points }]);

      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 2800);
    }

    window.addEventListener(POINTS_EARNED_EVENT, handlePointsEarned);
    return () => window.removeEventListener(POINTS_EARNED_EVENT, handlePointsEarned);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col items-end gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1.5 text-sm font-bold text-white shadow-lg"
        >
          <span aria-hidden="true">+</span>
          {toast.points}
        </div>
      ))}
    </div>
  );
}
