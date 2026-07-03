import Link from "next/link";
import { cn, ui } from "@/lib/ui/styles";

export function TutorAdminPanelBarLink() {
  return (
    <Link
      href="/admin/content"
      className="text-sm font-medium text-violet-600 transition-colors hover:text-violet-500"
    >
      Admin panel →
    </Link>
  );
}

export function TutorAdminPanelCard({ className }: { className?: string }) {
  return (
    <Link href="/admin/content" className={cn(ui.cardInteractive, className)}>
      <p className="font-semibold text-zinc-900">Admin panel</p>
      <p className="mt-1 text-sm text-zinc-500">
        Manage courses, lessons, packages, tutors, and calendar.
      </p>
      <p className="mt-2 text-sm font-semibold text-violet-600">Open admin panel →</p>
    </Link>
  );
}
