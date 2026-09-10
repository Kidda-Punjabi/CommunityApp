import { SwitchCohortPageView } from "@/components/learn/switch-cohort-page-view";
import { isSwitchCohortTrack } from "@/lib/calendar/cohort-week-progress";
import { loadSwitchCohortPage } from "@/lib/calendar/load-switch-cohort-page";
import { getLearnTrack } from "@/lib/learning/learn-catalog";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

export default async function SwitchCohortPage({
  params,
}: {
  params: Promise<{ track: string }>;
}) {
  const { track: trackId } = await params;
  const track = getLearnTrack(trackId);
  if (!track || !isSwitchCohortTrack(trackId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const data = await loadSwitchCohortPage(supabase, user, trackId);
  if (!data) redirect(`/dashboard/learn/${trackId}`);

  return <SwitchCohortPageView data={data} />;
}
