"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native/platform";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    const update = () => setOffline(navigator.onLine === false);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white">
      No internet connection
    </div>
  );
}
