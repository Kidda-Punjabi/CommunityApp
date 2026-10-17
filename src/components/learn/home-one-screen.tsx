import { CommunityHomeTile } from "@/components/community/check-in-ui";
import { RegisterInterestButton } from "@/components/learn/register-interest-button";
import { NavLink } from "@/components/ui/nav-link";
import type { AdultClassCard } from "@/lib/learning/load-adult-class-cards";
import type { ParentKidProgressSummary } from "@/lib/kids/load-kid-progress-summary";
import { levelFillVar } from "@/lib/community/levels";
import { Award, Wrench } from "lucide-react";

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
  return `${date} · ${time}`;
}

export function HomeOneScreen({
  courses,
  communityHref,
  communityStatus,
  communityLocked,
  communityLiveCheckIn = false,
  kids,
  timeZone,
}: {
  courses: CourseTile[];
  communityHref: string;
  communityStatus: string;
  communityLocked: boolean;
  communityLiveCheckIn?: boolean;
  kids: ParentKidProgressSummary[];
  timeZone: string;
}) {
  const shown = kids.slice(0, kids.length > 4 ? 3 : 4);
  const extra = kids.length > 4 ? kids.length - 3 : 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="grid flex-1 grid-cols-2 gap-2">
        {courses.map((course) => {
          const body = (
            <>
              <p className="text-[13px] font-extrabold leading-tight">{course.title}</p>
              {course.weekLesson ? (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-wide">Your course</p>
                  <p className="mt-1 text-[11px] font-semibold leading-snug">{course.weekLesson}</p>
                </>
              ) : (
                <p className="mt-1 text-[11px] font-semibold leading-snug">
                  {course.comingSoon ? "Coming soon" : course.enrolled ? "Your course" : "This course isn't on your account"}
                </p>
              )}
              {course.when ? <p className="mt-auto pt-1 text-[11px] font-bold">{course.when}</p> : null}
              {course.comingSoon ? (
                <span className="mt-1">
                  {course.interestRegistered ? (
                    <span className="inline-flex rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold">Interest registered</span>
                  ) : (
                    <RegisterInterestButton
                      courseTitle={course.title}
                      courseLevel={course.key === "advanced" ? "advanced" : "intermediate"}
                      initiallyRegistered={false}
                      compact
                    />
                  )}
                </span>
              ) : null}
            </>
          );
          const className = "flex min-h-[5.5rem] flex-col rounded-[20px] p-2.5";
          const style = { background: course.fill, color: course.ink };
          if (course.href) {
            return (
              <NavLink key={course.key} href={course.href} className={className} style={style}>
                {body}
              </NavLink>
            );
          }
          return (
            <div key={course.key} className={className} style={style}>
              {body}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <CommunityHomeTile
          href={communityLocked ? communityHref || undefined : communityHref}
          status={communityStatus}
          showLive={!communityLocked && communityLiveCheckIn}
        />
        <Shortcut href="/dashboard/learn/resources" title="Resources" status="Tools & shortcuts" icon={<Wrench className="h-4 w-4" />} />
        <Shortcut href="/dashboard/learn/certificates" title="Certificates" status="Your awards" icon={<Award className="h-4 w-4" />} />
      </div>
      {kids.length > 0 ? (
        <section className="rounded-[20px] bg-white px-3 py-2">
          <h2 className="text-xs font-extrabold text-[#1F1640]">How your kids are doing</h2>
          <div className="mt-1 flex justify-between gap-1">
            {shown.map((kid) => {
              const enrolled = Boolean(kid.courseId);
              const color = kid.currentLevelNumber != null ? levelFillVar(Math.min(9, Math.max(0, kid.currentLevelNumber))) : "#0E9F78";
              return (
                <NavLink key={kid.kidProfileId} href={`/dashboard/learn/kids-progress/${kid.kidProfileId}`} className="flex min-h-11 min-w-0 flex-1 flex-col items-center">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-[#1F1640] ${enrolled ? "" : "border-2 border-dashed border-[#C4B5FD]"}`}
                    style={enrolled ? { boxShadow: `0 0 0 2px ${color}` } : undefined}
                  >
                    {kid.kidName.slice(0, 1)}
                  </span>
                  <span className="mt-0.5 max-w-full truncate text-[10px] font-bold">{kid.kidName.split(" ")[0]}</span>
                  <span className="text-[9px] text-[#6B5F8A]">{enrolled ? kid.currentLevelLabel ?? "Kids Level 1" : "Not enrolled"}</span>
                </NavLink>
              );
            })}
            {extra > 0 ? (
              <NavLink href="/dashboard/learn/kids-progress" className="flex min-h-11 flex-1 flex-col items-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-[#C4B5FD] text-xs font-bold">+{extra}</span>
              </NavLink>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Shortcut({ href, title, status, icon }: { href?: string; title: string; status: string; icon: React.ReactNode }) {
  const body = (
    <>
      <span className="text-[#5B21B6]">{icon}</span>
      <span className="text-[11px] font-extrabold leading-tight">{title}</span>
      <span className="text-[9px] font-semibold text-[#6B5F8A]">{status}</span>
    </>
  );
  const className = "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-[18px] bg-white px-1 py-2 text-center text-[#1F1640]";
  if (!href) return <div className={className}>{body}</div>;
  return (
    <NavLink href={href} className={className}>
      {body}
    </NavLink>
  );
}

export function courseWhen(cards: AdultClassCard[], tier: AdultClassCard["tier"], timeZone: string): { weekLesson: string | null; when: string | null } {
  const card = cards.find((entry) => entry.tier === tier);
  return {
    weekLesson: card?.weekLesson ?? null,
    when: card?.nextStartsAt ? formatWhen(card.nextStartsAt, timeZone) : null,
  };
}
