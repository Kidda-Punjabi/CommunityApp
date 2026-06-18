"use client";

import { useEffect } from "react";
import {
  ACTIVITY_DATE_COOKIE,
  TIMEZONE_OFFSET_COOKIE,
  getLocalActivityDate,
} from "@/lib/progress/activity-date";

function writeActivityCookies() {
  const date = getLocalActivityDate();
  const offset = String(new Date().getTimezoneOffset());
  document.cookie = `${ACTIVITY_DATE_COOKIE}=${date}; path=/; max-age=86400; SameSite=Lax`;
  document.cookie = `${TIMEZONE_OFFSET_COOKIE}=${offset}; path=/; max-age=86400; SameSite=Lax`;
}

export function ActivityDateSync() {
  useEffect(() => {
    writeActivityCookies();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        writeActivityCookies();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return null;
}
