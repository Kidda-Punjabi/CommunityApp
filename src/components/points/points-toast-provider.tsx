"use client";

import { useEffect, useState } from "react";
import { POINTS_EARNED_EVENT, XP_EARNED_EVENT } from "@/lib/points/notify-points-earned";

type Toast = {
  id: number;
  amount: number;
  label: string;
};

export function PointsToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    function pushToast(amount: number, label: string) {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, amount, label }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 2800);
    }

    function handlePointsEarned(event: Event) {
      const points = (event as CustomEvent<number>).detail;
      if (!points || points <= 0) return;
      pushToast(points, "pts");
    }

    function handleXpEarned(event: Event) {
      const xp = (event as CustomEvent<number>).detail;
      if (!xp || xp <= 0) return;
      pushToast(xp, "XP");
    }

    window.addEventListener(POINTS_EARNED_EVENT, handlePointsEarned);
    window.addEventListener(XP_EARNED_EVENT, handleXpEarned);
    return () => {
      window.removeEventListener(POINTS_EARNED_EVENT, handlePointsEarned);
      window.removeEventListener(XP_EARNED_EVENT, handleXpEarned);
    };
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
          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold text-white shadow-lg ${
            toast.label === "XP" ? "bg-emerald-600" : "bg-violet-600"
          }`}
        >
          <span aria-hidden="true">+</span>
          {toast.amount} {toast.label}
        </div>
      ))}
    </div>
  );
}
