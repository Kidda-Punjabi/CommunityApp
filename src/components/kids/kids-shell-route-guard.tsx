"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useKidSession } from "@/components/kids/kid-session-provider";
import { isKidProfilePickerPath, usesKidsShell } from "@/lib/kids/constants";
import { planRedirect } from "@/lib/navigation/redirect-guard";

const KIDS_HOME = "/dashboard/kids";

/** Keep pre/early-reader kid sessions inside the kids shell. */
export function KidsShellRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeKidProfile } = useKidSession();
  const redirectedFrom = useRef<string | null>(null);

  useEffect(() => {
    if (!activeKidProfile || !usesKidsShell(activeKidProfile.age_tier)) return;
    if (pathname.startsWith("/dashboard/kids")) return;
    if (pathname.startsWith("/dashboard/tutor")) return;
    // Profile tab / picker must stay reachable while a kid is active, otherwise
    // this guard races profile switching and snaps back to the kid home.
    if (isKidProfilePickerPath(pathname)) return;
    const next = planRedirect({
      currentPath: pathname,
      destination: KIDS_HOME,
      redirectsAlreadyIssued: redirectedFrom.current === pathname ? 1 : 0,
    });
    if (!next) return;
    redirectedFrom.current = pathname;
    router.replace(next);
  }, [activeKidProfile, pathname, router]);

  return null;
}
