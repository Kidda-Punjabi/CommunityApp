/**
 * Native app detection.
 * Server code checks the user agent Capacitor appends (`KiddaApp/<version>`).
 * Client plugin code uses the same check Capacitor injects as `Capacitor.isNativePlatform()`.
 * Do not read `navigator.userAgent` in components.
 */

const NATIVE_APP_UA = "KiddaApp/";

export function isNativeAppRequest(headerList: Headers): boolean {
  const userAgent = headerList.get("user-agent") ?? "";
  return userAgent.includes(NATIVE_APP_UA);
}

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function capacitorGlobal(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNativeApp(): boolean {
  return capacitorGlobal()?.isNativePlatform?.() === true;
}

/** Web and iOS stay on their existing paths. Android-only branches check this. */
export function nativePlatform(): "ios" | "android" | "web" {
  const platform = capacitorGlobal()?.getPlatform?.();
  if (platform === "ios" || platform === "android") return platform;
  return "web";
}
