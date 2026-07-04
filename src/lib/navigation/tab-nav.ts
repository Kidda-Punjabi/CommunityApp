export type TabId = "home" | "learn" | "community" | "games" | "profile";

export const TAB_IDS: TabId[] = ["home", "learn", "community", "games", "profile"];

export const TAB_ROOTS: Record<TabId, string> = {
  home: "/dashboard/home",
  learn: "/dashboard/learn",
  community: "/dashboard/community",
  games: "/dashboard/games",
  profile: "/dashboard/profile",
};

const STORAGE_KEY = "kidda-active-tab";

export function tabIdFromHref(href: string): TabId {
  if (href === "/dashboard/learn") return "learn";
  if (href === "/dashboard/community") return "community";
  if (href === "/dashboard/games") return "games";
  if (href === "/dashboard/profile") return "profile";
  return "home";
}

export function getStoredActiveTab(): TabId | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(STORAGE_KEY);
  if (value && TAB_IDS.includes(value as TabId)) {
    return value as TabId;
  }
  return null;
}

export function storeActiveTab(tab: TabId) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, tab);
}

export function tabFromRootPath(pathname: string): TabId | null {
  for (const tab of TAB_IDS) {
    if (pathname === TAB_ROOTS[tab]) return tab;
  }
  return null;
}

export function inferTabFromPathname(pathname: string): TabId {
  if (
    pathname === "/dashboard/home" ||
    pathname === "/dashboard/notifications" ||
    pathname.startsWith("/dashboard/schedule")
  ) {
    return "home";
  }

  if (
    pathname.startsWith("/dashboard/learn") ||
    pathname.startsWith("/dashboard/placement") ||
    pathname.startsWith("/dashboard/level-test") ||
    pathname.startsWith("/dashboard/resources")
  ) {
    return "learn";
  }

  if (
    pathname.startsWith("/dashboard/community") ||
    pathname === "/dashboard/leaderboard"
  ) {
    return "community";
  }

  if (
    pathname.startsWith("/dashboard/games") ||
    pathname.startsWith("/dashboard/practice") ||
    pathname.startsWith("/dashboard/battle") ||
    pathname.startsWith("/dashboard/group-games") ||
    pathname.startsWith("/dashboard/challenges")
  ) {
    return "games";
  }

  if (
    pathname.startsWith("/dashboard/profile") ||
    pathname === "/dashboard/friends" ||
    pathname.startsWith("/dashboard/membership")
  ) {
    return "profile";
  }

  return "home";
}
