"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin/content/curriculum", label: "Learn" },
  { href: "/admin/content/games", label: "Games" },
] as const;

export function AdminContentSubNav() {
  const pathname = usePathname();

  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Content</p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-violet-600 text-white"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
