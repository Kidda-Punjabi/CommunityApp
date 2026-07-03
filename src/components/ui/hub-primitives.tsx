import Link from "next/link";
import { cn } from "@/lib/ui/styles";

export const hubCardClass =
  "rounded-xl border border-zinc-200 bg-white px-6 py-5";

export function HubCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(hubCardClass, className)}>{children}</div>;
}

export function EyebrowLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-xs font-medium text-zinc-500", className)}>{children}</p>
  );
}

export function HubPrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function HubSecondaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function HubGhostLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("text-sm font-medium text-violet-600 hover:text-violet-500", className)}
    >
      {children}
    </Link>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <span className={cn("text-lg leading-none text-zinc-400", className)} aria-hidden="true">
      ›
    </span>
  );
}

export function SummaryRow({
  href,
  title,
  children,
  className,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(hubCardClass, "block transition-colors hover:bg-zinc-50", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-900">{title}</p>
          <div className="mt-1">{children}</div>
        </div>
        <ChevronRight className="mt-0.5 shrink-0" />
      </div>
    </Link>
  );
}

export function AccountListRow({
  href,
  onClick,
  label,
  className,
}: {
  href?: string;
  onClick?: () => void;
  label: string;
  className?: string;
}) {
  const rowClass = cn(
    "flex w-full items-center justify-between gap-3 py-3 text-left text-sm font-medium text-zinc-900 transition-colors hover:text-violet-600",
    className
  );

  const trailing = <ChevronRight />;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={rowClass}>
        <span>{label}</span>
        {trailing}
      </button>
    );
  }

  return (
    <Link href={href ?? "#"} className={rowClass}>
      <span>{label}</span>
      {trailing}
    </Link>
  );
}

export function StatusBadge({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: "success" | "neutral" | "live";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variant === "success"
          ? "border-green-200 bg-green-50 text-green-700"
          : variant === "live"
            ? "border-orange-200 bg-orange-50 text-orange-700"
            : "border-zinc-200 bg-white text-zinc-600"
      )}
    >
      {children}
    </span>
  );
}

const actionIconTileClass =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-lg";

export function ActionListRow({
  href,
  icon,
  eyebrow,
  title,
  subtitle,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 py-3 transition-colors hover:bg-zinc-50"
    >
      <span className={actionIconTileClass} aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <EyebrowLabel>{eyebrow}</EyebrowLabel>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-zinc-900">{title}</p>
          {badge}
        </div>
        {subtitle ? <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p> : null}
      </div>
      <ChevronRight className="shrink-0" />
    </Link>
  );
}
