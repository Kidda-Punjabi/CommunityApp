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
  className,
}: {
  href?: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  badge?: string | null;
  corner?: ReactNode;
  stacked?: boolean;
  className?: string;
}) {
  const body = (
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
    "relative flex h-24 w-full shrink-0 rounded-[20px] bg-white px-3 text-left",
    stacked ? "flex-col items-start justify-center gap-1" : "items-center gap-2.5",
    corner ? "pr-14" : "",
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
