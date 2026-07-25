"use client";

import { useOptionalTabNav } from "@/components/navigation/tab-nav-provider";
import { cn } from "@/lib/ui/styles";
import Link from "next/link";
import type { ReactNode } from "react";

export const backLinkClass =
  "text-sm font-medium text-violet-600 hover:text-violet-500";

type BackLinkProps = {
  children?: ReactNode;
  fallbackHref?: string;
  /**
   * When set, always navigate to this href (no history.back).
   * Use inside activity flows where history would replay in-lesson steps.
   */
  href?: string;
  className?: string;
};

export function BackLink({
  children = "← Back",
  fallbackHref,
  href,
  className,
}: BackLinkProps) {
  const tabNav = useOptionalTabNav();
  const classNames = cn(backLinkClass, className);
  const target = href ?? fallbackHref ?? "/";

  // Forced destination, or public pages outside TabNavProvider.
  if (href || !tabNav) {
    return (
      <Link href={target} className={classNames}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => tabNav.goBack(fallbackHref ?? tabNav.getTabRoot())}
      className={classNames}
    >
      {children}
    </button>
  );
}
