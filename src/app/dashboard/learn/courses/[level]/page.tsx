import { RegisterInterestButton } from "@/components/learn/register-interest-button";
import { BackLink } from "@/components/navigation/back-link";
import {
  LEARN_COURSE_LEVELS,
  isComingSoonLevel,
  type LearnCourseLevelId,
} from "@/lib/learn/course-levels";
import { loadRegisteredComingSoonLevels } from "@/lib/learn/course-interest";
import { learnTrackPath } from "@/lib/learning/learn-catalog";
import { cn, ui } from "@/lib/ui/styles";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
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

  if (!isComingSoonLevel(rawLevel)) {
    if (rawLevel === "beginners" || rawLevel === "foundational") {
      redirect(learnTrackPath(rawLevel));
    }
    notFound();
  }

  const theme = LEARN_COURSE_LEVELS[rawLevel];
  const Icon = theme.Icon;
  const registered = await loadRegisteredComingSoonLevels(session.supabase, session.user.id);

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

      <div className="mt-8">
        <RegisterInterestButton
          courseTitle={theme.title}
          courseLevel={rawLevel}
          initiallyRegistered={registered.has(rawLevel)}
          className={cn("w-full py-3 text-sm", theme.ctaClass)}
        />
      </div>
    </div>
  );
}
