import { BookAssessmentButton } from "@/components/learn/book-assessment-button";
import { RegisterInterestButton } from "@/components/learn/register-interest-button";
import { BackLink } from "@/components/navigation/back-link";
import { NavLink } from "@/components/ui/nav-link";
import {
  LEARN_COURSE_LEVELS,
  isComingSoonLevel,
  type LearnCourseLevelId,
} from "@/lib/learn/course-levels";
import { getLearnTrack, learnTrackPath } from "@/lib/learning/learn-catalog";
import { isLearnTrackUnlocked } from "@/lib/learning/learn-access";
import {
  getCachedAuthSession,
  getCachedCourseAccess,
} from "@/lib/supabase/cached-session";
import { cn, ui } from "@/lib/ui/styles";
import { notFound, redirect } from "next/navigation";

const LEVEL_IDS: LearnCourseLevelId[] = [
  "foundational",
  "beginners",
  "intermediate",
  "advanced",
];

function isLevelId(value: string): value is LearnCourseLevelId {
  return LEVEL_IDS.includes(value as LearnCourseLevelId);
}

export default async function LearnCourseDetailPage({
  params,
}: {
  params: Promise<{ level: string }>;
}) {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const { level: rawLevel } = await params;
  if (!isLevelId(rawLevel)) notFound();

  const theme = LEARN_COURSE_LEVELS[rawLevel];
  const Icon = theme.Icon;
  const comingSoon = isComingSoonLevel(rawLevel);

  let enrolled = false;
  if (rawLevel === "beginners" || rawLevel === "foundational") {
    const track = getLearnTrack(rawLevel);
    if (track) {
      const access = await getCachedCourseAccess(session.supabase, session.user);
      enrolled = isLearnTrackUnlocked(track, access);
    }
  }

  const enrolHref =
    rawLevel === "beginners"
      ? enrolled
        ? learnTrackPath("beginners")
        : "/courses/beginners"
      : rawLevel === "foundational"
        ? enrolled
          ? learnTrackPath("foundational")
          : "/courses/foundational"
        : null;

  return (
    <div className={ui.page}>
      <BackLink href="/dashboard/learn">← Back to Learn</BackLink>

      <div className={cn("mt-4 rounded-3xl p-5", theme.rowBg)}>
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl",
            theme.iconWrap
          )}
        >
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <h1 className={cn("mt-4 font-heading text-2xl font-bold", theme.ink)}>
          {theme.title}
        </h1>
        <p className={cn("mt-1 text-sm font-medium", theme.mutedInk)}>
          CEFR {theme.cefr} · {theme.duration}
        </p>
      </div>

      <section className="mt-6">
        <h2 className="font-heading text-sm font-semibold text-zinc-900">What you&apos;ll learn</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{theme.whatYouLearn}</p>
      </section>

      <section className="mt-5">
        <h2 className="font-heading text-sm font-semibold text-zinc-900">By the end</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{theme.byTheEnd}</p>
      </section>

      {comingSoon ? (
        <div className="mt-8">
          <RegisterInterestButton
            courseTitle={theme.title}
            className={cn("w-full py-3 text-sm", theme.ctaClass)}
          />
        </div>
      ) : (
        <>
          {enrolHref ? (
            <NavLink
              href={enrolHref}
              className={cn(
                ui.btnPrimaryBlock,
                "mt-8",
                rawLevel === "beginners" && !enrolled ? "" : undefined
              )}
            >
              {enrolled ? "Continue learning" : "Enrol in course"}
            </NavLink>
          ) : null}

          {rawLevel === "beginners" ? (
            <div className="mt-5 rounded-3xl border border-zinc-200 bg-white p-5">
              <p className="text-sm font-semibold text-zinc-900">
                Already speak some Punjabi?
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                Take the assessment with a tutor. Pass and you&apos;ll get the certificate
                straight away, no course needed.
              </p>
              <p className="mt-3 text-xs font-medium text-zinc-500">£30 · with a tutor</p>
              <div className="mt-4">
                <BookAssessmentButton />
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
