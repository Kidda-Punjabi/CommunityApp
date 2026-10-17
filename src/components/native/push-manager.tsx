"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isNativeApp, nativePlatform } from "@/lib/native/platform";
import {
  registerDevicePushToken,
  touchDevicePushToken,
  unreadPushBadgeCount,
} from "@/app/dashboard/push/actions";

const TOKEN_KEY = "kidda.pushToken";

async function setBadge(count: number): Promise<void> {
  try {
    const { Badge } = await import("@capawesome/capacitor-badge");
    if (count <= 0) await Badge.clear();
    else await Badge.set({ count });
  } catch {
    // The badge plugin is only present in the iOS shell.
  }
}

export function storedPushToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function PushManager() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isNativeApp()) return;
    let removeRegistration: (() => void) | undefined;
    let removeAction: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const platform = nativePlatform() === "android" ? "android" : "ios";
      if (platform === "android") {
        await PushNotifications.createChannel({
          id: "kidda",
          name: "Kidda",
          description: "Class reminders and homework",
          importance: 3,
        }).catch(() => undefined);
      }
      const registration = await PushNotifications.addListener("registration", (event) => {
        localStorage.setItem(TOKEN_KEY, event.value);
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        void import("@capacitor/app").then(async ({ App }) => {
          const info = await App.getInfo().catch(() => null);
          await registerDevicePushToken({
            token: event.value,
            timezone,
            appVersion: info?.version ?? "",
            platform,
          });
        });
      });
      const action = await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
        const url = event.notification.data?.url;
        if (typeof url !== "string" || !url) return;
        if (/^https?:\/\//i.test(url) && !url.startsWith(window.location.origin)) {
          void import("@capacitor/app-launcher").then(({ AppLauncher }) => AppLauncher.openUrl({ url }));
          return;
        }
        window.location.assign(url);
      });
      if (cancelled) {
        await registration.remove();
        await action.remove();
        return;
      }
      removeRegistration = () => void registration.remove();
      removeAction = () => void action.remove();

      const permission = await PushNotifications.checkPermissions();
      if (permission.receive === "granted") await PushNotifications.register();
      const existing = storedPushToken();
      if (existing) await touchDevicePushToken(existing);
    })();

    return () => {
      cancelled = true;
      removeRegistration?.();
      removeAction?.();
    };
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;
    if (pathname.startsWith("/dashboard/notifications")) {
      void setBadge(0);
      return;
    }
    if (!pathname.startsWith("/dashboard")) return;
    void unreadPushBadgeCount().then((count) => setBadge(count));
  }, [pathname]);

  return null;
}
