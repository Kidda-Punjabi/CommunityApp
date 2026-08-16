"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useKidSession } from "@/components/kids/kid-session-provider";
import { isKidProfilePickerPath, usesKidsShell } from "@/lib/kids/constants";

/** Keep pre/early-reader kid sessions inside the kids shell. */
export function KidsShellRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeKidProfile } = useKidSession();

  useEffect(() => {
    if (!activeKidProfile || !usesKidsShell(activeKidProfile.age_tier)) return;
    if (pathname.startsWith("/dashboard/kids")) return;
    // Picker must stay reachable while a kid is active, otherwise this guard
    // races the chip/back navigation and snaps back to the kid home.
    if (isKidProfilePickerPath(pathname)) return;
    router.replace("/dashboard/kids");
  }, [activeKidProfile, pathname, router]);

  return null;
}
