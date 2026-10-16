"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native/platform";

type Permission = "granted" | "denied" | "prompt";

export function PushSettingsSwitch() {
  const [native, setNative] = useState(false);
  const [permission, setPermission] = useState<Permission>("prompt");

  useEffect(() => {
    if (!isNativeApp()) return;
    setNative(true);
    void import("@capacitor/push-notifications").then(async ({ PushNotifications }) => {
      const status = await PushNotifications.checkPermissions();
      setPermission(status.receive === "granted" || status.receive === "denied" ? status.receive : "prompt");
    });
  }, []);

  if (!native) return null;

  async function enable() {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const status = await PushNotifications.requestPermissions();
    setPermission(status.receive === "granted" || status.receive === "denied" ? status.receive : "prompt");
    if (status.receive === "granted") await PushNotifications.register();
  }

  async function openSettings() {
    const { AppLauncher } = await import("@capacitor/app-launcher");
    await AppLauncher.openUrl({ url: "app-settings:" });
  }

  return (
    <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-900">Push notifications</p>
          <p className="text-xs text-zinc-500">
            {permission === "granted"
              ? "Alerts are on for this iPhone."
              : permission === "denied"
                ? "Alerts are off in iOS Settings."
                : "Turn on reminders for classes and homework."}
          </p>
        </div>
        <input
          type="checkbox"
          checked={permission === "granted"}
          onChange={() => {
            if (permission === "granted") void openSettings();
            else void enable();
          }}
          aria-label="Push notifications"
          className="mt-1 h-4 w-4 rounded border-zinc-300 text-violet-600"
        />
      </div>
      {permission === "denied" && (
        <button
          type="button"
          onClick={() => void openSettings()}
          className="mt-3 text-sm font-semibold text-violet-700"
        >
          Open iOS Settings
        </button>
      )}
    </div>
  );
}
