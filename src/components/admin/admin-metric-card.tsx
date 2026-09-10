import Link from "next/link";
import type { DashboardTone } from "@/lib/admin/dashboard/types";
import { cn } from "@/lib/ui/styles";
import type { ReactNode } from "react";

const toneDot: Record<DashboardTone, string> = {
  ok: "bg-emerald-500",
  warning: "bg-amber-400",
  urgent: "bg-red-500",
};

const toneCount: Record<DashboardTone, string> = {
  ok: "text-emerald-700",
  warning: "text-amber-700",
  urgent: "text-red-700",
};

const chrome =
  "rounded-[12px] border-[0.5px] border-zinc-200 bg-white px-4 py-4";

export type AdminMetricCardProps = {
  label: string;
  value?: number;
  hint?: string;
  href?: string;
  /** Status cards show a health dot and coloured count. Omit for plain summary metrics. */
  tone?: DashboardTone;
  loading?: boolean;
};

function MetricCardBody({
  label,
  value,
  hint,
  tone,
  loading,
}: Omit<AdminMetricCardProps, "href">) {
  const isStatus = tone != null;
  const showHint = isStatus || hint != null;

  if (loading) {
    return (
      <div className="animate-pulse" aria-hidden="true">
        <div className="flex items-center justify-between gap-2">
          <div className="h-4 w-[9.5rem] max-w-[70%] rounded bg-zinc-100" />
          {isStatus ? <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-zinc-100" /> : null}
        </div>
        <div className="mt-2 h-9 w-14 rounded bg-zinc-100" />
        {showHint ? (
          <div className="mt-1 min-h-[2.25rem] space-y-1">
            <div className="h-3 w-full rounded bg-zinc-100" />
            <div className="h-3 w-4/5 rounded bg-zinc-100" />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-zinc-600">{label}</p>
        {isStatus ? (
          <span
            className={cn("h-2.5 w-2.5 shrink-0 rounded-full", toneDot[tone])}
            aria-label={tone === "ok" ? "Green" : tone === "warning" ? "Yellow" : "Red"}
          />
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold tabular-nums tracking-tight",
          isStatus ? toneCount[tone] : "text-zinc-900"
        )}
      >
        {value}
      </p>
      {showHint && hint != null ? (
        <p className="mt-1 min-h-[2.25rem] line-clamp-2 text-[12px] leading-snug text-zinc-500">
          {hint}
        </p>
      ) : showHint ? (
        <div className="mt-1 min-h-[2.25rem]" />
      ) : null}
    </>
  );
}

function CardFrame({
  href,
  loading,
  children,
}: {
  href?: string;
  loading: boolean;
  children: ReactNode;
}) {
  const className = cn(chrome, href && !loading && "transition-colors hover:bg-zinc-50");

  if (href && !loading) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <div className={className} aria-busy={loading}>
      {loading ? <span className="sr-only">Loading</span> : null}
      {children}
    </div>
  );
}

export function AdminMetricCard({
  label,
  value,
  hint,
  href,
  tone,
  loading = false,
}: AdminMetricCardProps) {
  return (
    <CardFrame href={href} loading={loading}>
      <MetricCardBody
        label={label}
        value={value}
        hint={hint}
        tone={tone}
        loading={loading}
      />
    </CardFrame>
  );
}
