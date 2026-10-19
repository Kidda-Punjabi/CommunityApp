"use client";

import { useEffect, useState } from "react";

/** Learning layouts widen from this width, and only inside the native apps. */
export const NATIVE_TABLET_MIN_WIDTH_PX = 600;

export function nativeTabletNow(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.documentElement.classList.contains("kidda-native") &&
    window.matchMedia(`(min-width: ${NATIVE_TABLET_MIN_WIDTH_PX}px)`).matches
  );
}

export function useNativeTablet(): boolean {
  const [tablet, setTablet] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${NATIVE_TABLET_MIN_WIDTH_PX}px)`);
    const update = () => setTablet(nativeTabletNow());
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return tablet;
}
