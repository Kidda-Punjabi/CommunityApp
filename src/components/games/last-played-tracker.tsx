"use client";

import { recordLastPlayedFromPath } from "@/lib/games/last-played";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function LastPlayedGameTracker() {
  const pathname = usePathname();

  useEffect(() => {
    recordLastPlayedFromPath(pathname);
  }, [pathname]);

  return null;
}
