"use client";

import { PageSpinner, armPageSpinner } from "@/components/ui/page-spinner";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const PendingHrefContext = createContext<string | null>(null);

export function usePendingHref() {
  return useContext(PendingHrefContext);
}

function pathOf(href: string): string | null {
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export function NavigationPendingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("button, input, textarea, select, [role='button']")) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const next = pathOf(anchor.href);
      if (!next) return;
      const here = `${window.location.pathname}${window.location.search}`;
      if (next === here) return;
      armPageSpinner();
      setPendingFrom(window.location.pathname);
      setPendingHref(next);
      if (!anchor.closest("nav, .kidda-bottom-chrome")) {
        const pressable = anchor.closest(".kidda-pressable") ?? anchor;
        pressable.classList.add("is-pending");
      }
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!pendingHref || !pendingFrom) return;
    if (pathname !== pendingFrom) {
      setPendingHref(null);
      setPendingFrom(null);
    }
  }, [pathname, pendingHref, pendingFrom]);

  useEffect(() => {
    if (pendingHref) return;
    document.querySelectorAll(".is-pending").forEach((node) => node.classList.remove("is-pending"));
  }, [pendingHref]);

  useEffect(() => {
    if (!pendingHref) return;
    const timer = window.setTimeout(() => {
      setPendingHref(null);
      setPendingFrom(null);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [pendingHref]);

  return <PendingHrefContext.Provider value={pendingHref}>{children}</PendingHrefContext.Provider>;
}

export function PendingOverlay() {
  const pendingHref = usePendingHref();
  if (!pendingHref) return null;
  return <PageSpinner overlay />;
}
