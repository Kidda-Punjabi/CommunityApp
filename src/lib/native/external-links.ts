const VIDEO_CALL_HOSTS = new Set(["meet.google.com", "zoom.us", "teams.microsoft.com"]);

export type LinkDecision = "allow" | "browser" | "launcher" | "download";

function hostnameOf(url: URL): string {
  return url.hostname.toLowerCase();
}

export function isVideoCallUrl(url: URL): boolean {
  const host = hostnameOf(url);
  if (VIDEO_CALL_HOSTS.has(host)) return true;
  return host.endsWith(".zoom.us") || host.endsWith(".teams.microsoft.com");
}

export function isLauncherUrl(raw: string): boolean {
  const value = raw.trim();
  if (/^(mailto:|tel:|sms:|whatsapp:|intent:)/i.test(value)) return true;
  try {
    const url = new URL(value);
    const host = hostnameOf(url);
    return (
      host === "wa.me" ||
      host === "api.whatsapp.com" ||
      host === "whatsapp.com" ||
      host.endsWith(".whatsapp.com")
    );
  } catch {
    return false;
  }
}

export function isSameSiteUrl(url: URL, currentOrigin: string): boolean {
  let currentHost = "";
  try {
    currentHost = new URL(currentOrigin).hostname.toLowerCase();
  } catch {
    currentHost = "";
  }
  const host = hostnameOf(url);
  return host === currentHost || host === "webapp.kidda.app";
}

export function decideLink(
  raw: string,
  currentOrigin: string,
  options?: { download?: boolean }
): LinkDecision {
  const value = raw.trim();
  if (!value || value.startsWith("#") || value.toLowerCase().startsWith("javascript:")) {
    return "allow";
  }
  if (options?.download || value.startsWith("blob:") || value.startsWith("data:")) {
    return "download";
  }
  if (isLauncherUrl(value)) return "launcher";

  let url: URL;
  try {
    url = new URL(value, currentOrigin);
  } catch {
    return "allow";
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "launcher";
  }
  if (isVideoCallUrl(url)) return "launcher";
  if (isSameSiteUrl(url, currentOrigin)) return "allow";
  return "browser";
}

export function downloadFileName(raw: string, downloadAttr: string | null): string {
  const named = downloadAttr?.trim();
  if (named && named !== "true") return named;
  try {
    const url = new URL(raw);
    const last = url.pathname.split("/").filter(Boolean).pop();
    if (last) return decodeURIComponent(last);
  } catch {
    // Blob and data URLs have no path.
  }
  return "Kidda-download";
}
