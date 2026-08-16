"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KidLucideIcon } from "@/components/kids/kid-lucide-icon";
import { useKidSession } from "@/components/kids/kid-session-provider";
import { cn, ui } from "@/lib/ui/styles";

export function ProfileSwitchChip() {
  const pathname = usePathname();
  const { activeKidProfile, hasKidProfiles, parentInitial } = useKidSession();

  if (!hasKidProfiles) return null;
  if (pathname === "/dashboard/profile/kids") {
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
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", ui.avatarKid)}>
          <KidLucideIcon name={activeKidProfile.avatar_icon} className="h-5 w-5" />
        </span>
      ) : (
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold", ui.avatarParent)}>
          {parentInitial}
        </span>
      )}
    </Link>
  );
}
