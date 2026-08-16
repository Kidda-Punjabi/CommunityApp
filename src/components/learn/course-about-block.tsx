import { LEARN_COURSE_LEVELS, type LearnCourseLevelId } from "@/lib/learn/course-levels";

export function CourseAboutBlock({ level }: { level: LearnCourseLevelId }) {
  const theme = LEARN_COURSE_LEVELS[level];

  return (
    <div className="rounded-3xl border border-zinc-200/70 bg-white p-5">
      <h2 className="font-heading text-sm font-semibold text-zinc-900">What you&apos;ll learn</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">{theme.whatYouLearn}</p>
      <h2 className="mt-5 font-heading text-sm font-semibold text-zinc-900">By the end</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">{theme.byTheEnd}</p>
    </div>
  );
}
