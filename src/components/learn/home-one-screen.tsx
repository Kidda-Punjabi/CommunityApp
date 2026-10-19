import { CommunityHomeTile } from "@/components/community/check-in-ui";
import { RegisterInterestButton } from "@/components/learn/register-interest-button";
import { AppTile } from "@/components/ui/app-tile";
import { NavLink } from "@/components/ui/nav-link";
import { levelFillVar } from "@/lib/community/levels";
import type { AdultClassCard } from "@/lib/learning/load-adult-class-cards";
import type { ParentKidProgressSummary } from "@/lib/kids/load-kid-progress-summary";
import { Award, Check, ChevronRight, Smile, Wrench } from "lucide-react";

type CourseTile = {
  key: "foundational" | "beginners" | "intermediate" | "advanced";
  title: string;
  href?: string;
  enrolled: boolean;
  comingSoon: boolean;
  interestRegistered?: boolean;
  weekLesson: string | null;
  when: string | null;
  fill: string;
  ink: string;
};

function formatWhen(iso: string, timeZone: string): string {
  const start = new Date(iso);
  const date = start.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  });
  const time = start.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  });
  return `${date}, ${time}`;
}

function courseSubtitle(course: CourseTile): string {
  if (course.comingSoon) return "Coming soon";
  if (!course.enrolled) return "This course isn't on your account";
  if (course.weekLesson && course.when) {
    const lesson = course.weekLesson.replace(/\s*[-–]\s*Week \d+\s*$/i, "");
    return `${lesson} · ${course.when}`;
  }
  return "Your course";
}

export function HomeOneScreen({
  courses,
  communityHref,
  communityStatus,
  communityLocked,
  communityLiveCheckIn = false,
  kids,
}: {
  courses: CourseTile[];
  communityHref: string;
  communityStatus: string;
  communityLocked: boolean;
  communityLiveCheckIn?: boolean;
  kids: ParentKidProgressSummary[];
  timeZone: string;
}) {
  const enrolledKids = kids.filter((kid) => kid.courseId);
  const shownAvatars = enrolledKids.slice(0, 3);
  const extraAvatars = kids.length - shownAvatars.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        {courses.map((course) => {
          const subtitle = courseSubtitle(course);
          const right = course.comingSoon ? (
            course.interestRegistered ? (
              <span className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-xs font-bold text-[#075E47]">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Interest registered
              </span>
            ) : (
              <RegisterInterestButton
                courseTitle={course.title}
                courseLevel={course.key === "advanced" ? "advanced" : "intermediate"}
                initiallyRegistered={false}
                className="relative h-9 bg-[#5B21B6] px-3 text-xs font-bold text-white before:absolute before:-inset-y-1 before:inset-x-0"
              />
            )
          ) : course.enrolled && course.href ? (
            <ChevronRight className="h-5 w-5 shrink-0" aria-hidden style={{ color: course.ink }} />
          ) : null;
          const className = "flex h-[68px] w-full shrink-0 items-center gap-3 rounded-[20px] px-4";
          const style = { background: course.fill, color: course.ink };
          const body = (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-heading text-base font-bold leading-tight text-[#1F1640]">
                  {course.title}
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-semibold leading-tight">{subtitle}</span>
              </span>
              {right}
            </>
          );
          if (course.href && course.enrolled) {
            return (
              <NavLink key={course.key} href={course.href} data-testid="course-row" className={className} style={style}>
                {body}
              </NavLink>
            );
          }
          return (
            <div key={course.key} data-testid="course-row" className={className} style={style}>
              {body}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 content-start gap-2 tab:grid-cols-4">
        <CommunityHomeTile
          href={communityLocked ? communityHref || undefined : communityHref}
          status={communityStatus}
          showLive={!communityLocked && communityLiveCheckIn}
        />
        {kids.length > 0 ? (
          <AppTile
            href="/dashboard/learn/your-kids"
            title="Your kids"
            subtitle={`${kids.length} ${kids.length === 1 ? "kid" : "kids"} · ${enrolledKids.length} enrolled`}
            icon={<Smile className="h-4 w-4" />}
            stacked
            corner={
              <span className="flex items-center">
                {shownAvatars.map((kid, index) => (
                  <span
                    key={kid.kidProfileId}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F7F5FC] text-[10px] font-bold text-[#1F1640]"
                    style={{
                      marginLeft: index === 0 ? 0 : -6,
                      boxShadow: `0 0 0 2px ${levelFillVar(Math.min(9, Math.max(0, kid.currentLevelNumber ?? 0)))}`,
                    }}
                  >
                    {kid.kidName.slice(0, 1)}
                  </span>
                ))}
                {extraAvatars > 0 ? (
                  <span className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-[#C4B5FD] bg-white text-[10px] font-bold text-[#3B1A8C]">
                    +{extraAvatars}
                  </span>
                ) : null}
              </span>
            }
          />
        ) : null}
        <AppTile href="/dashboard/learn/resources" title="Resources" subtitle="Tools & shortcuts" icon={<Wrench className="h-4 w-4" />} />
        <AppTile href="/dashboard/learn/certificates" title="Certificates" subtitle="Your awards" icon={<Award className="h-4 w-4" />} />
      </div>
    </div>
  );
}

export function courseWhen(cards: AdultClassCard[], tier: AdultClassCard["tier"], timeZone: string): { weekLesson: string | null; when: string | null } {
  const card = cards.find((entry) => entry.tier === tier);
  return {
    weekLesson: card?.weekLesson ?? null,
    when: card?.nextStartsAt ? formatWhen(card.nextStartsAt, timeZone) : null,
  };
}
