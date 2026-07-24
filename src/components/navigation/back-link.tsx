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
  className?: string;
};

export function BackLink({
  children = "← Back",
  fallbackHref,
  className,
}: BackLinkProps) {
  const tabNav = useOptionalTabNav();
  const classNames = cn(backLinkClass, className);

  // Public pages (e.g. /courses) sit outside TabNavProvider — use a plain link.
  if (!tabNav) {
    return (
      <Link href={fallbackHref ?? "/"} className={classNames}>
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
