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
      {comingSoon ? (
        <div className="mt-4 flex items-end justify-between gap-3">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
              theme.tagBg,
              theme.tagInk
            )}
          >
            Coming soon
          </span>
          <RegisterInterestButton courseTitle={theme.title} className={theme.ctaClass} />
        </div>
      ) : null}
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

  if (comingSoon) {
    return (
      <div data-tour={tourId} className={shell}>
        <NavLink href={href} className={cn(pressableClass, "-m-1 rounded-2xl p-1")}>
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
              <p className={cn("font-heading text-base font-semibold leading-snug", theme.ink)}>
                {theme.title}
              </p>
              <p className={cn("mt-1 text-xs font-medium", theme.mutedInk)}>{status}</p>
            </div>
          </div>
        </NavLink>
        <div className="mt-4 flex items-end justify-between gap-3">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
              theme.tagBg,
              theme.tagInk
            )}
          >
            Coming soon
          </span>
          <RegisterInterestButton courseTitle={theme.title} className={theme.ctaClass} />
        </div>
      </div>
    );
  }

  return (
    <NavLink href={href} data-tour={tourId} className={cn(pressableClass, shell, "hover:opacity-95")}>
      {body}
    </NavLink>
  );
}
