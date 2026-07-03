import Link from "next/link";
import { ui } from "@/lib/ui/styles";
import type { ReactNode } from "react";

type AdminPeopleSectionShellProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
};

export function AdminPeopleSectionShell({
  title,
  subtitle,
  backHref = "/admin/content/people",
  backLabel = "Back to People",
  children,
}: AdminPeopleSectionShellProps) {
  return (
    <div className={ui.page}>
      <Link
        href={backHref}
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← {backLabel}
      </Link>

      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
      </div>

      {children}
    </div>
  );
}
