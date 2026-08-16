"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KidLucideIcon } from "@/components/kids/kid-lucide-icon";
import { useKidSession } from "@/components/kids/kid-session-provider";

export function ProfileSwitchChip() {
  const pathname = usePathname();
  const { activeKidProfile, hasKidProfiles, parentInitial } = useKidSession();

  if (!hasKidProfiles) return null;
  if (pathname === "/dashboard/profile/kids" || pathname.startsWith("/dashboard/profile/kids/")) {
    return null;
  }

  const label = activeKidProfile
    ? `Switch profile (now ${activeKidProfile.name})`
    : "Switch profile";

  return (
    <Link
      href="/dashboard/profile/kids"
      aria-label={label}
      title={label}
      className="fixed right-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow ring-1 ring-zinc-200 backdrop-blur hover:bg-white"
    >
      {activeKidProfile ? (
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-400 text-white">
          <KidLucideIcon name={activeKidProfile.avatar_icon} className="h-5 w-5" />
        </span>
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
          {parentInitial}
        </span>
      )}
    </Link>
  );
}
