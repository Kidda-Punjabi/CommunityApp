"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/native/platform";
import { decideLink, downloadFileName } from "@/lib/native/external-links";

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
  if (decision === "launcher") {
    const { AppLauncher } = await import("@capacitor/app-launcher");
    await AppLauncher.openUrl({ url: href });
    return;
  }
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: href });
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
        await Keyboard.setAccessoryBarVisible({ isVisible: true });
        await Keyboard.setResizeMode({ mode: KeyboardResize.Native });

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
          await urlHandle.remove();
          return;
        }
        cleanups.push(() => {
          void showHandle.remove();
          void hideHandle.remove();
          void urlHandle.remove();
          document.documentElement.classList.remove("kidda-keyboard-open");
        });
      } catch {
        // Plugin setup only runs inside the iOS shell.
      }
    })();

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) cleanup();
    };
  }, []);

  return null;
}
