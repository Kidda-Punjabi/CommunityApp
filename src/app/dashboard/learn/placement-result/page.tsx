import { LearnCourseRow } from "@/components/learn/learn-course-row";
import { BackLink } from "@/components/navigation/back-link";
import { NavLink } from "@/components/ui/nav-link";
import { courseDetailPath } from "@/lib/learn/course-levels";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

/**
 * Layout-only placement result. Not wired to a real placement test yet.
 */
export default async function PlacementResultPage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  return (
    <div className={ui.page}>
      <BackLink href="/dashboard/learn">← Back to Learn</BackLink>
      <div className="mb-6 mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          Placement result
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
          We recommend Beginner
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Your answers point to A2 — you can greet people, use simple sentences, and you&apos;re
          ready for live conversation practice rather than starting from the alphabet.
        </p>
      </div>

      <LearnCourseRow
        level="beginners"
        href={courseDetailPath("beginners")}
        status="Recommended for you"
      />

      <NavLink href={courseDetailPath("beginners")} className={`${ui.btnPrimaryBlock} mt-6`}>
        View Beginner course
      </NavLink>

      <NavLink
        href="/dashboard/learn"
        className="mt-4 block text-center text-sm font-semibold text-violet-600 hover:text-violet-500"
      >
        See all courses
      </NavLink>
    </div>
  );
}
