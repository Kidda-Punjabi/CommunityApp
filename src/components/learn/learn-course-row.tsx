import { NavLink } from "@/components/ui/nav-link";
import { RegisterInterestButton } from "@/components/learn/register-interest-button";
import {
  LEARN_COURSE_LEVELS,
  type LearnCourseLevelId,
} from "@/lib/learn/course-levels";
import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";

type LearnCourseRowProps = {
  level: LearnCourseLevelId;
  href?: string;
  status: string;
  percent?: number | null;
  comingSoon?: boolean;
  tourId?: string;
};

export function LearnCourseRow({
  level,
  href,
  status,
  percent = null,
  comingSoon = false,
  tourId,
}: LearnCourseRowProps) {
  const theme = LEARN_COURSE_LEVELS[level];
  const Icon = theme.Icon;

  if (comingSoon) {
    const icon = (
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          theme.iconWrap
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
    );
    const copy = (
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={cn("whitespace-nowrap font-heading text-sm font-semibold leading-tight", theme.ink)}>
            {theme.title}
          </p>
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
              theme.tagBg,
              theme.tagInk
            )}
          >
            Coming soon
          </span>
        </div>
        <p className={cn("mt-0.5 truncate text-[11px] font-medium leading-tight", theme.mutedInk)}>
          {status}
        </p>
      </div>
    );
    const cta = (
      <RegisterInterestButton
        courseTitle={theme.title}
        compact
        className={theme.ctaClass}
      />
    );

    return (
      <div
        data-tour={tourId}
        className={cn(
          "flex min-h-[60px] items-center gap-2 rounded-2xl px-3 py-2 shadow-[0_1px_8px_-4px_rgba(24,24,27,0.06)]",
          theme.rowBg
        )}
      >
        {href ? (
          <NavLink
            href={href}
            className={cn(pressableClass, "flex min-w-0 flex-1 items-center gap-2")}
          >
            {icon}
            {copy}
          </NavLink>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {icon}
            {copy}
          </div>
        )}
        {cta}
      </div>
    );
  }

  const body = (
    <>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
            theme.iconWrap
          )}
        >
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={cn("font-heading text-base font-semibold leading-snug", theme.ink)}>
              {theme.title}
            </p>
            {percent != null ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                  theme.tagBg,
                  theme.tagInk
                )}
              >
                {percent}%
              </span>
            ) : null}
          </div>
          <p className={cn("mt-1 text-xs font-medium", theme.mutedInk)}>{status}</p>
        </div>
      </div>
    </>
  );

  const shell = cn(
    "block rounded-3xl p-4 shadow-[0_2px_16px_-4px_rgba(24,24,27,0.08)]",
    theme.rowBg
  );

  if (!href) {
    return (
      <div data-tour={tourId} className={shell}>
        {body}
      </div>
    );
  }

  return (
    <NavLink href={href} data-tour={tourId} className={cn(pressableClass, shell, "hover:opacity-95")}>
      {body}
    </NavLink>
  );
}
