"use client";

import { useEffect, useState } from "react";

/** Tablet layout when the shorter screen side is at least this many CSS pixels. */
export const NATIVE_TABLET_MIN_SHORTEST_SIDE_PX = 600;

export function nativeTabletNow(): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  const shortest = Math.min(window.screen.width, window.screen.height);
  return (
    document.documentElement.classList.contains("kidda-native") &&
    shortest >= NATIVE_TABLET_MIN_SHORTEST_SIDE_PX
  );
}

export function useNativeTablet(): boolean {
  const [tablet, setTablet] = useState(false);

  useEffect(() => {
    const min = NATIVE_TABLET_MIN_SHORTEST_SIDE_PX;
    const media = window.matchMedia(
      `(min-device-width: ${min}px) and (min-device-height: ${min}px)`
    );
    const update = () => setTablet(nativeTabletNow());
    update();
    media.addEventListener("change", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return tablet;
}
