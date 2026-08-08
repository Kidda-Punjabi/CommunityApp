import { EnglishFoundationsPath } from "@/components/english/english-foundations-path";
import {
  fetchLearnEnglishHomeCourse,
  loadEnglishFoundationsPathItems,
} from "@/lib/learning/english-foundations-path";
import { fetchAccessiblePrivateCourses } from "@/lib/learning/private-courses";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

export default async function EnglishHomePage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const { supabase, user } = session;

  const privateCourses = await fetchAccessiblePrivateCourses(supabase, user.id);
  if (privateCourses.length === 0) {
    redirect("/dashboard/profile");
  }

  const homeCourse = await fetchLearnEnglishHomeCourse(supabase, user.id);
  if (!homeCourse) {
    redirect("/dashboard/profile");
  }

  const pathItems = await loadEnglishFoundationsPathItems(
    supabase,
    user.id,
    homeCourse.id
  );

  return (
    <div className={ui.page}>
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Learn English
        </p>
        <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-zinc-900">
          {homeCourse.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Finish each lesson to unlock the next.
        </p>
      </div>

      {pathItems.length > 0 ? (
        <EnglishFoundationsPath items={pathItems} />
      ) : (
        <p className="text-center text-sm text-zinc-500">
          Lessons coming soon.
        </p>
      )}
    </div>
  );
}
