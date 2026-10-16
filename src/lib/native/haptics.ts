"use client";

import { isNativeApp } from "@/lib/native/platform";

export async function hapticSuccess(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Haptics are optional. A missing plugin must not block the action.
  }
}
