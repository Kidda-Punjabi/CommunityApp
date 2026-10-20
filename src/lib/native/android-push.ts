import { nativePlatform } from "@/lib/native/platform";

/** versionCode 1 has no Firebase app, so PushNotifications.register crashes it. */
export const ANDROID_PUSH_MIN_BUILD = 2;

export async function androidMayRegisterPush(): Promise<boolean> {
  if (nativePlatform() !== "android") return false;
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    const build = Number.parseInt(info.build, 10);
    return Number.isFinite(build) && build >= ANDROID_PUSH_MIN_BUILD;
  } catch {
    return false;
  }
}
