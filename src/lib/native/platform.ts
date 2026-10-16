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
};

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const capacitor = (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor;
  return capacitor?.isNativePlatform?.() === true;
}
