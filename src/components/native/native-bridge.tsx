"use client";

import { useEffect } from "react";
import { isNativeApp, nativePlatform } from "@/lib/native/platform";
import { androidMayRegisterPush } from "@/lib/native/android-push";
import { decideLink, downloadFileName, isVideoCallUrl } from "@/lib/native/external-links";
import { followPushNotification } from "@/lib/native/push-url";

function safeFileName(name: string): string {
  const cleaned = name.replace(/[^\w.\- ]+/g, "").trim();
  return cleaned || "Kidda-download";
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function shareDownload(href: string, fileName: string): Promise<void> {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");
  const response = await fetch(href);
  if (!response.ok) return;
  const blob = await response.blob();
  const path = `downloads/${Date.now()}-${safeFileName(fileName)}`;
  await Filesystem.writeFile({
    path,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
  });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  await Share.share({
    title: fileName,
    url: uri,
    dialogTitle: fileName,
  });
}

async function openExternal(decision: "browser" | "launcher", href: string): Promise<void> {
  if (decision === "launcher" && nativePlatform() === "android") {
    let video = false;
    try {
      video = isVideoCallUrl(new URL(href));
    } catch {
      video = false;
    }
    if (video) {
      const { AppLauncher } = await import("@capacitor/app-launcher");
      const canOpen = await AppLauncher.canOpenUrl({ url: href }).catch(() => ({ value: false }));
      if (canOpen.value) {
        await AppLauncher.openUrl({ url: href });
        return;
      }
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: href });
      return;
    }
  }
  if (decision === "launcher") {
    const { AppLauncher } = await import("@capacitor/app-launcher");
    await AppLauncher.openUrl({ url: href });
    return;
  }
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: href });
}

const TOP_LEVEL = new Set([
  "/dashboard/learn",
  "/dashboard/home",
  "/dashboard/community",
  "/dashboard/games",
  "/dashboard/profile",
  "/dashboard/kids",
  "/dashboard/kids/stickers",
  "/dashboard/kids/match",
  "/dashboard/profile/kids",
]);

function homeFor(path: string): string {
  if (path.startsWith("/dashboard/kids") || path.startsWith("/dashboard/profile/kids")) {
    return "/dashboard/kids";
  }
  return "/dashboard/learn";
}

function closeOpenSheet(): boolean {
  const dialog = document.querySelector("[aria-modal='true']");
  if (!dialog) return false;
  const buttons = [...dialog.querySelectorAll("button")];
  const close = buttons.find((button) => {
    const label = button.getAttribute("aria-label")?.trim() ?? "";
    const text = button.textContent?.trim() ?? "";
    return /^(close|cancel|dismiss)$/i.test(label) || /^(close|cancel|dismiss)$/i.test(text);
  });
  if (close) {
    close.click();
    return true;
  }
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  return true;
}

export function NativeBridge() {
  useEffect(() => {
    if (!isNativeApp()) return;

    let cancelled = false;
    const cleanups: Array<() => void> = [];
    const originalOpen = window.open.bind(window);

    function routeHref(
      href: string,
      options: { download?: boolean; downloadName?: string | null }
    ) {
      const decision = decideLink(href, window.location.origin, { download: options.download });
      if (decision === "allow") return false;
      if (decision === "download") {
        void shareDownload(href, downloadFileName(href, options.downloadName ?? null)).catch(
          () => undefined
        );
        return true;
      }
      void openExternal(decision, href).catch(() => undefined);
      return true;
    }

    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      const href = anchor.href;
      if (!href) return;
      const handled = routeHref(href, {
        download: anchor.hasAttribute("download"),
        downloadName: anchor.getAttribute("download"),
      });
      if (!handled) return;
      event.preventDefault();
      event.stopPropagation();
    }

    window.open = (url?: string | URL, target?: string, features?: string) => {
      const raw = url == null ? "" : String(url);
      if (!raw) return originalOpen(url, target, features);
      const absolute = new URL(raw, window.location.origin).href;
      const handled = routeHref(absolute, {
        download: raw.startsWith("blob:") || raw.startsWith("data:"),
      });
      if (handled) return null;
      return originalOpen(url, target, features);
    };

    document.addEventListener("click", onClick, true);
    cleanups.push(() => {
      document.removeEventListener("click", onClick, true);
      window.open = originalOpen;
    });

    function onFocusIn(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const tag = target.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return;
      window.setTimeout(() => {
        target.scrollIntoView({ block: "center", inline: "nearest" });
      }, 300);
    }
    document.addEventListener("focusin", onFocusIn);
    cleanups.push(() => document.removeEventListener("focusin", onFocusIn));

    void (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        const { SplashScreen } = await import("@capacitor/splash-screen");
        const { Keyboard, KeyboardResize } = await import("@capacitor/keyboard");
        const { App } = await import("@capacitor/app");
        if (cancelled) return;

        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: "#fafafa" });
        if (nativePlatform() === "ios") {
          await Keyboard.setAccessoryBarVisible({ isVisible: true });
          // Android's Keyboard plugin rejects setResizeMode as unimplemented, and a
          // rejection here skips splash hide and the back handler. Resize on Android
          // comes from the manifest (adjustResize) and capacitor.config.
          await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
        }

        let splashHidden = false;
        const hideSplash = () => {
          if (splashHidden) return;
          splashHidden = true;
          void SplashScreen.hide({ fadeOutDuration: 200 });
        };
        requestAnimationFrame(() => requestAnimationFrame(hideSplash));
        const splashTimer = window.setTimeout(hideSplash, 5000);
        cleanups.push(() => window.clearTimeout(splashTimer));

        const showHandle = await Keyboard.addListener("keyboardWillShow", () => {
          document.documentElement.classList.add("kidda-keyboard-open");
        });
        const hideHandle = await Keyboard.addListener("keyboardWillHide", () => {
          document.documentElement.classList.remove("kidda-keyboard-open");
        });
        let lastHomeBack = 0;
        const backHandle =
          nativePlatform() === "android"
            ? await App.addListener("backButton", ({ canGoBack }) => {
                if (closeOpenSheet()) return;
                const path = window.location.pathname;
                if (TOP_LEVEL.has(path)) {
                  const home = homeFor(path);
                  if (path !== home) {
                    window.location.assign(home);
                    return;
                  }
                  const now = Date.now();
                  if (now - lastHomeBack < 2000) {
                    void App.exitApp();
                    return;
                  }
                  lastHomeBack = now;
                  return;
                }
                if (canGoBack) {
                  window.history.back();
                  return;
                }
              })
            : null;
        const pushHandle =
          nativePlatform() === "android" && !(await androidMayRegisterPush())
            ? null
            : await import("@capacitor/push-notifications").then(({ PushNotifications }) =>
                PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
                  followPushNotification(event.notification.data);
                })
              );
        const urlHandle = await App.addListener("appUrlOpen", (event) => {
          try {
            const url = new URL(event.url);
            if (url.hostname !== "webapp.kidda.app" && url.hostname !== window.location.hostname) {
              return;
            }
            const next = `${url.pathname}${url.search}${url.hash}`;
            const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
            if (next && next !== current) window.location.assign(next);
          } catch {
            // Ignore malformed universal links.
          }
        });
        if (cancelled) {
          await showHandle.remove();
          await hideHandle.remove();
          await pushHandle?.remove();
          await urlHandle.remove();
          await backHandle?.remove();
          return;
        }
        cleanups.push(() => {
          void showHandle.remove();
          void hideHandle.remove();
          void pushHandle?.remove();
          void urlHandle.remove();
          void backHandle?.remove();
          document.documentElement.classList.remove("kidda-keyboard-open");
        });
      } catch {
        // Plugin setup only runs inside the native shell.
      }
    })();

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) cleanup();
    };
  }, []);

  return null;
}
