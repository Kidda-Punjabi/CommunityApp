"use client";

import {
  type TabId,
  TAB_ROOTS,
  getStoredActiveTab,
  inferTabFromPathname,
  storeActiveTab,
  tabFromRootPath,
} from "@/lib/navigation/tab-nav";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type TabNavContextValue = {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  goBack: (fallbackHref?: string) => void;
  getTabRoot: () => string;
};

const TabNavContext = createContext<TabNavContextValue | null>(null);

export function useTabNav() {
  const context = useContext(TabNavContext);
  if (!context) {
    throw new Error("useTabNav must be used within TabNavProvider");
  }
  return context;
}

/** Safe outside the dashboard shell (e.g. public marketing /courses pages). */
export function useOptionalTabNav() {
  return useContext(TabNavContext);
}

export function TabNavProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeTab, setActiveTabState] = useState<TabId>("home");
  const initializedRef = useRef(false);

  useEffect(() => {
    const rootTab = tabFromRootPath(pathname);

    if (!initializedRef.current) {
      initializedRef.current = true;
      const stored = getStoredActiveTab();
      if (rootTab) {
        setActiveTabState(rootTab);
        storeActiveTab(rootTab);
      } else if (stored) {
        setActiveTabState(stored);
      } else {
        const inferred = inferTabFromPathname(pathname);
        setActiveTabState(inferred);
        storeActiveTab(inferred);
      }
      return;
    }

    if (rootTab) {
      setActiveTabState(rootTab);
      storeActiveTab(rootTab);
    }
  }, [pathname]);

  const setActiveTab = useCallback((tab: TabId) => {
    setActiveTabState(tab);
    storeActiveTab(tab);
  }, []);

  const getTabRoot = useCallback(() => TAB_ROOTS[activeTab], [activeTab]);

  const goBack = useCallback(
    (fallbackHref?: string) => {
      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
        return;
      }
      router.push(fallbackHref ?? TAB_ROOTS[activeTab]);
    },
    [router, activeTab]
  );

  const value = useMemo(
    () => ({ activeTab, setActiveTab, goBack, getTabRoot }),
    [activeTab, setActiveTab, goBack, getTabRoot]
  );

  return <TabNavContext.Provider value={value}>{children}</TabNavContext.Provider>;
}
