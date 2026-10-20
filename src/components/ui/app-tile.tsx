import { NavLink } from "@/components/ui/nav-link";
import { cn } from "@/lib/ui/styles";
import type { ReactNode } from "react";

export function AppTile({
  href,
  title,
  subtitle,
  icon,
  badge,
  corner,
  stacked = false,
  compact = false,
  className,
}: {
  href?: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  badge?: string | null;
  corner?: ReactNode;
  stacked?: boolean;
  /** Icon above the label, for a tight grid. Other screens keep the wide tile. */
  compact?: boolean;
  className?: string;
}) {
  const body = compact ? (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EDE7FE] text-[#5B21B6]">
        {icon}
      </span>
      <span className="min-w-0 text-center">
        <span className="block font-heading text-xs font-bold leading-tight text-[#1F1640]">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block text-[10px] font-semibold leading-tight text-[#6B5F8A]">{subtitle}</span>
        ) : null}
      </span>
      {badge ? (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-[#FDE68A] px-1.5 py-0.5 text-[10px] font-extrabold text-[#3B1A8C]">
          {badge}
        </span>
      ) : null}
    </>
  ) : (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EDE7FE] text-[#5B21B6]">
        {icon}
      </span>
      <span className={stacked ? "min-w-0" : "min-w-0 flex-1"}>
        <span className="block truncate font-heading text-sm font-bold leading-tight text-[#1F1640]">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block truncate text-[11px] font-semibold leading-tight text-[#6B5F8A]">{subtitle}</span>
        ) : null}
      </span>
      {corner ? <span className="absolute right-2 top-2 flex items-center">{corner}</span> : null}
      {badge ? (
        <span className="absolute right-2 top-2 rounded-full bg-[#FDE68A] px-1.5 py-0.5 text-[10px] font-extrabold text-[#3B1A8C]">
          {badge}
        </span>
      ) : null}
    </>
  );
  const classNames = cn(
    "relative flex w-full rounded-[20px] bg-white text-left",
    compact
      ? "h-full min-h-[72px] flex-col items-center justify-center gap-1 px-1.5 py-2 text-center"
      : "h-24 shrink-0 px-3",
    !compact && (stacked ? "flex-col items-start justify-center gap-1" : "items-center gap-2.5"),
    !compact && corner && !stacked ? "pr-14" : "",
    className
  );
  if (!href) {
    return (
      <div data-testid="app-tile" className={classNames}>
        {body}
      </div>
    );
  }
  return (
    <NavLink data-testid="app-tile" href={href} className={classNames}>
      {body}
    </NavLink>
  );
}
