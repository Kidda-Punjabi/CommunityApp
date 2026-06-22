"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Supabase sometimes redirects to Site URL (/) with auth params in the hash
 * fragment, which the server never sees. Forward those to the right page.
 */
export function AuthRedirectHandler() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;

    const hashParams = new URLSearchParams(hash);
    const hasAuthParams =
      hashParams.has("access_token") ||
      hashParams.has("code") ||
      hashParams.has("error") ||
      hashParams.has("error_description");

    if (!hasAuthParams) return;

    const type = hashParams.get("type");
    const isRecovery = type === "recovery";
    const hasError = hashParams.has("error") || hashParams.has("error_description");

    if (pathname !== "/") return;

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
      const next = isRecovery ? "/reset-password" : "/dashboard/home";
      window.location.replace(
        `/auth/callback?next=${encodeURIComponent(next)}&code=${encodeURIComponent(code)}`
      );
    }
  }, [pathname]);

  return null;
}
