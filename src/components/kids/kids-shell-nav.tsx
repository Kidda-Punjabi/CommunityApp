"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KidLucideIcon } from "@/components/kids/kid-lucide-icon";
import type { KidAgeTier } from "@/lib/kids/constants";

const navItems = [
  { href: "/dashboard/kids", label: "Play", icon: "Rocket" },
  { href: "/dashboard/kids/stickers", label: "Stickers", icon: "Star" },
] as const;

export function KidsShellNav({ ageTier }: { ageTier: KidAgeTier }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-sky-200 bg-gradient-to-t from-sky-100 to-white/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg justify-around px-4">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-[5rem] flex-col items-center gap-1 rounded-2xl px-4 py-2 ${
                active ? "bg-violet-100 text-violet-700" : "text-sky-700"
              }`}
            >
              <KidLucideIcon name={item.icon} className="h-8 w-8" />
              <span className="text-xs font-bold">{item.label}</span>
            </Link>
          );
        })}
        {ageTier === "early_reader" && (
          <Link
            href="/dashboard/kids/match"
            className={`flex min-w-[5rem] flex-col items-center gap-1 rounded-2xl px-4 py-2 ${
              pathname.startsWith("/dashboard/kids/match")
                ? "bg-violet-100 text-violet-700"
                : "text-sky-700"
            }`}
          >
            <KidLucideIcon name="Gem" className="h-8 w-8" />
            <span className="text-xs font-bold">Match</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
