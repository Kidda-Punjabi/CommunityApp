import { headers } from "next/headers";
import { getPublicAppUrl } from "@/lib/app-url";

function hostFromHeaders(headerList: Headers): string | null {
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return null;
  return host.split(",")[0]?.trim() ?? null;
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.startsWith("127.0.0.1") ||
    hostname.endsWith(".local")
  );
}

/**
 * Best URL for share links — prefers the live request host in production,
 * so referral links match the domain the user is actually on.
 */
export async function getShareAppUrl(): Promise<string> {
  try {
    const headerList = await headers();
    const hostname = hostFromHeaders(headerList);
    if (hostname && !isLocalHost(hostname)) {
      const proto = headerList.get("x-forwarded-proto") ?? "https";
      return `${proto}://${hostname}`.replace(/\/$/, "");
    }
  } catch {
    // headers() only available during a request
  }

  return getPublicAppUrl();
}
