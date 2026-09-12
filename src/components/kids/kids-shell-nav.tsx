"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KidLucideIcon } from "@/components/kids/kid-lucide-icon";

export function KidsShellNav({ ageTier }: { ageTier: string }) {
  const pathname = usePathname();

  const items = [
    {
      href: "/dashboard/kids",
      label: "Play",
      icon: "Rocket",
      active: pathname === "/dashboard/kids",
    },
    {
      href: "/dashboard/kids/stickers",
      label: "Stickers",
      icon: "Star",
      active: pathname.startsWith("/dashboard/kids/stickers"),
    },
    ...(ageTier === "early_reader"
      ? [
          {
            href: "/dashboard/kids/match",
            label: "Match",
            icon: "Gem",
            active: pathname.startsWith("/dashboard/kids/match"),
          },
        ]
      : []),
    {
      href: "/dashboard/profile/kids",
      label: "Profile",
      icon: "User",
      active: pathname.startsWith("/dashboard/profile/kids"),
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-sky-200 bg-gradient-to-t from-sky-100 to-white/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 ${
              item.active ? "bg-violet-100 text-violet-700" : "text-sky-700"
            }`}
          >
            <KidLucideIcon name={item.icon} className="h-8 w-8" />
            <span className="text-xs font-bold">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
