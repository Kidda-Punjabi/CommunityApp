/** Same-origin path from a push payload, or null when the link should not be followed. */
export function sameOriginPushPath(raw: unknown, origin: string): string | null {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.origin !== origin) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
  } catch {
    return null;
  }
}

export function followPushNotification(data: { url?: unknown } | null | undefined): void {
  const path = sameOriginPushPath(data?.url, window.location.origin);
  if (!path) return;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (path === current) return;
  window.location.assign(path);
}
