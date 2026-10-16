"use client";

import Link from "next/link";
import { useNativeApp } from "@/lib/native/native-app-context";
import { ui } from "@/lib/ui/styles";

type HelpArticlesLinkProps = {
  href: string;
  className?: string;
};

export function HelpArticlesLink({ href, className }: HelpArticlesLinkProps) {
  const nativeApp = useNativeApp();
  return (
    <Link href={href} className={className ?? ui.cardInteractive}>
      <p className="font-semibold text-zinc-900">Help Centre</p>
      <p className="mt-1 text-sm text-zinc-500">
        {nativeApp
          ? "Guides for using Kidda — homework, lessons, and your account."
          : "Cancellations, cohorts, and guides for using Kidda — homework, lessons, billing, and more."}
      </p>
      <p className="mt-2 text-sm font-semibold text-violet-600">Browse help →</p>
    </Link>
  );
}
