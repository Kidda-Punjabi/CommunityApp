"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native/platform";
import { nextClassEndsAt } from "@/app/dashboard/push/actions";

const STATE_KEY = "kidda.pushPrompt";
const AFTER_KEY = "kidda.pushAfterClass";

export function PushPermissionPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    const state = localStorage.getItem(STATE_KEY);
    if (state === "done") return;
    void (async () => {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const permission = await PushNotifications.checkPermissions();
      if (permission.receive === "granted") {
        localStorage.setItem(STATE_KEY, "done");
        return;
      }
      if (state === "later") {
        const after = localStorage.getItem(AFTER_KEY);
        if (!after || Date.now() < new Date(after).getTime()) return;
      }
      setOpen(true);
    })();
  }, []);

  if (!open) return null;

  async function allow() {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.requestPermissions();
    await PushNotifications.register();
    localStorage.setItem(STATE_KEY, "done");
    setOpen(false);
  }

  async function notNow() {
    const state = localStorage.getItem(STATE_KEY);
    if (state === "later") {
      localStorage.setItem(STATE_KEY, "done");
      setOpen(false);
      return;
    }
    const ends = await nextClassEndsAt().catch(() => null);
    localStorage.setItem(STATE_KEY, "later");
    localStorage.setItem(
      AFTER_KEY,
      ends ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    );
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-zinc-900/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-3xl bg-white px-6 py-7 text-center shadow-xl">
        <img src="/logo/kidda-peacock.png" alt="" className="mx-auto h-16 w-16" />
        <h2 className="mt-4 text-xl font-bold text-zinc-900">Never miss a class</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Get reminders before your classes and when homework is due.
        </p>
        <button
          type="button"
          onClick={() => void allow()}
          className="mt-6 w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white"
        >
          Allow notifications
        </button>
        <button
          type="button"
          onClick={() => void notNow()}
          className="mt-2 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-zinc-600"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
