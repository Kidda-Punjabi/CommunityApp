import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn, ui } from "@/lib/ui/styles";
import type { ReactNode } from "react";

export type AdminHubTone = "neutral" | "warning" | "urgent";

const cardClass =
  "rounded-[12px] border-[0.5px] border-zinc-200 bg-white";

const toneIconClass: Record<AdminHubTone, string> = {
  neutral: "bg-sky-50 text-sky-600",
  warning: "bg-amber-50 text-amber-700",
  urgent: "bg-red-50 text-red-600",
};

export function AdminHubPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className={ui.page}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function AdminHubStack({ children }: { children: ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

export function AdminHubLinkCard({
  href,
  icon,
  title,
  summary,
  count,
  tone = "neutral",
}: {
  href: string;
  icon: ReactNode;
  title: string;
  summary: string;
  count?: number | null;
  tone?: AdminHubTone;
}) {
  const showCount = count != null;

  return (
    <Link
      href={href}
      className={cn(
        cardClass,
        "flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-zinc-50"
      )}
    >
      <span
        className={cn(
          "flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px]",
          toneIconClass[tone]
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-zinc-900">{title}</p>
        <p className="mt-0.5 truncate text-[13px] text-zinc-500">{summary}</p>
      </div>
      {showCount ? (
        <span
          className={cn(
            "inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
            count > 0
              ? tone === "urgent"
                ? "bg-red-50 text-red-700"
                : tone === "warning"
                  ? "bg-amber-50 text-amber-800"
                  : "bg-sky-50 text-sky-700"
              : "bg-zinc-100 text-zinc-500"
          )}
        >
          {count}
        </span>
      ) : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
    </Link>
  );
}

export function adminHubCardClass() {
  return cardClass;
}
