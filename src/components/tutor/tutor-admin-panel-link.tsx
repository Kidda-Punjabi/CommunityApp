"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, ui } from "@/lib/ui/styles";

export function TutorAdminPanelBar() {
  const pathname = usePathname();
  if (pathname === "/dashboard/tutor") return null;

  return (
    <div className="relative left-1/2 w-dvw -translate-x-1/2 border-b border-violet-200/60 bg-white">
      <div className="mx-auto flex max-w-lg justify-end px-5 py-2.5">
        <TutorAdminPanelBarLink />
      </div>
    </div>
  );
}

export function TutorAdminPanelBarLink() {
  return (
    <Link
      href="/admin"
      className="text-sm font-medium text-violet-600 transition-colors hover:text-violet-500"
    >
      Admin panel →
    </Link>
  );
}

export function TutorAdminPanelCard({ className }: { className?: string }) {
  return (
    <Link href="/admin" className={cn(ui.cardInteractive, className)}>
      <p className="font-semibold text-zinc-900">Admin panel</p>
      <p className="mt-1 text-sm text-zinc-500">
        Manage courses, lessons, packages, tutors, and calendar.
      </p>
      <p className="mt-2 text-sm font-semibold text-violet-600">Open admin panel →</p>
    </Link>
  );
}
