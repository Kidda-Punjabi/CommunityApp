import { SwitchCohortPageView } from "@/components/learn/switch-cohort-page-view";
import { loadKidsSwitchCohortPage } from "@/lib/calendar/load-switch-cohort-page";
import { fetchAccessibleKidsCourses } from "@/lib/learning/kids-courses";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

type KidsSwitchCohortPageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function KidsSwitchCohortPage({ params }: KidsSwitchCohortPageProps) {
  const { courseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const kidsCourses = await fetchAccessibleKidsCourses(supabase, user.id);
  if (!kidsCourses.some((course) => course.id === courseId)) notFound();

  const data = await loadKidsSwitchCohortPage(supabase, user, courseId);
  if (!data) redirect(`/dashboard/learn/kids/${courseId}`);

  return <SwitchCohortPageView data={data} />;
}
