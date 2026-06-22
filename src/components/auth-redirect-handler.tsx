"use client";

import {
  AUTH_RECOVERY_COOKIE,
  authCallbackNextPath,
  buildAuthCallbackUrl,
} from "@/lib/auth/recovery-flow";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function hasRecoveryCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((part) => part.trim().startsWith(`${AUTH_RECOVERY_COOKIE}=1`));
}

/**
 * Supabase may redirect to Site URL (/) with auth params in the query or hash.
 * Server middleware/page should handle query `code`; this covers hash fragments.
 */
export function AuthRedirectHandler() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const queryCode = searchParams.get("code");
    const queryType = searchParams.get("type");
    const queryError = searchParams.get("error_description");

    if (pathname === "/" && queryCode) {
      const next = authCallbackNextPath(queryType, hasRecoveryCookie());
      window.location.replace(buildAuthCallbackUrl(window.location.origin, queryCode, next));
      return;
    }

    if (pathname === "/" && queryError) {
      const dest =
        authCallbackNextPath(queryType, hasRecoveryCookie()) === "/reset-password"
          ? "/reset-password"
          : "/login";
      window.location.replace(
        `${dest}?error_description=${encodeURIComponent(queryError)}`
      );
      return;
    }

    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;

    const hashParams = new URLSearchParams(hash);
    const hasAuthParams =
      hashParams.has("access_token") ||
      hashParams.has("code") ||
      hashParams.has("error") ||
      hashParams.has("error_description");

    if (!hasAuthParams || pathname !== "/") return;

    const type = hashParams.get("type");
    const isRecovery = type === "recovery" || hasRecoveryCookie();
    const hasError = hashParams.has("error") || hashParams.has("error_description");

    window.history.replaceState(null, "", pathname);

    if (hashParams.has("access_token")) {
      window.location.replace(`/reset-password#${hash}`);
      return;
    }

    if (hasError) {
      const description =
        hashParams.get("error_description") ??
        hashParams.get("error") ??
        "Email link is invalid or has expired.";
      window.location.replace(
        `/reset-password?error_description=${encodeURIComponent(description)}`
      );
      return;
    }

    const code = hashParams.get("code");
    if (code) {
      const next = authCallbackNextPath(type, isRecovery);
      window.location.replace(buildAuthCallbackUrl(window.location.origin, code, next));
    }
  }, [pathname, searchParams]);

  return null;
}
