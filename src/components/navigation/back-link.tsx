"use client";

import { useTabNav } from "@/components/navigation/tab-nav-provider";
import { cn } from "@/lib/ui/styles";
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
  const { goBack, getTabRoot } = useTabNav();

  return (
    <button
      type="button"
      onClick={() => goBack(fallbackHref ?? getTabRoot())}
      className={cn(backLinkClass, className)}
    >
      {children}
    </button>
  );
}
