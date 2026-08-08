import {
  EnglishLearnTiles,
  iconForEnglishLearnCourse,
  statusForEnglishLearnCourse,
  toneForEnglishLearnIndex,
  type EnglishLearnTile,
} from "@/components/english/english-learn-tiles";
import {
  fetchAccessiblePrivateCourses,
  fetchLearnEnglishLearnCourses,
} from "@/lib/learning/private-courses";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

export default async function EnglishLearnPage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const { supabase, user } = session;

  // Gate: user must have Learn English private access (same as the English shell).
  const privateCourses = await fetchAccessiblePrivateCourses(supabase, user.id);
  if (privateCourses.length === 0) {
    redirect("/dashboard/profile");
  }

  const courses = await fetchLearnEnglishLearnCourses(supabase, user.id);

  const tiles: EnglishLearnTile[] = courses.map((course, index) => ({
    id: course.id,
    href: `/dashboard/english/learn/${course.id}`,
    title: course.name,
    status: statusForEnglishLearnCourse(course.lessonCount),
    tone: toneForEnglishLearnIndex(index),
    icon: iconForEnglishLearnCourse(course.name),
  }));

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Learn</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Practical English courses for life in the UK.
        </p>
      </div>

      {tiles.length > 0 ? (
        <EnglishLearnTiles tiles={tiles} />
      ) : (
        <p className="text-center text-sm text-zinc-500">
          Courses will appear here when they&apos;re ready for you.
        </p>
      )}
    </div>
  );
}
