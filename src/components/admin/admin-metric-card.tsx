import Link from "next/link";
import type { DashboardTone } from "@/lib/admin/dashboard/types";
import { cn } from "@/lib/ui/styles";
import type { ReactNode } from "react";

const toneCount: Record<DashboardTone, string> = {
  ok: "text-emerald-700",
  warning: "text-amber-700",
  urgent: "text-red-700",
};

const toneLabel: Record<DashboardTone, string> = {
  ok: "Healthy",
  warning: "Needs attention",
  urgent: "Urgent",
};

const chrome = "rounded-[12px] border-[0.5px] border-zinc-200 bg-white px-4 py-4";

export type AdminMetricCardProps = {
  label: string;
  value?: number;
  href?: string;
  /** Health cards colour the count. Omit for plain summary metrics. */
  tone?: DashboardTone;
  loading?: boolean;
};

function MetricCardBody({
  label,
  value,
  tone,
  loading,
}: Omit<AdminMetricCardProps, "href">) {
  if (loading) {
    return (
      <div className="animate-pulse" aria-hidden="true">
        <div className="h-4 w-[9.5rem] max-w-[70%] rounded bg-zinc-100" />
        <div className="mt-2 h-9 w-14 rounded bg-zinc-100" />
      </div>
    );
  }

  return (
    <>
      <p className="text-[13px] font-medium text-zinc-600">{label}</p>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold tabular-nums tracking-tight",
          tone ? toneCount[tone] : "text-zinc-900"
        )}
      >
        {value}
        {tone ? <span className="sr-only"> {toneLabel[tone]}</span> : null}
      </p>
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
  href,
  tone,
  loading = false,
}: AdminMetricCardProps) {
  return (
    <CardFrame href={href} loading={loading}>
      <MetricCardBody label={label} value={value} tone={tone} loading={loading} />
    </CardFrame>
  );
}
