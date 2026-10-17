import { Celebration } from "@/components/community/celebration";
import { formatWeekdayDate } from "@/lib/community/format";
import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { redirect } from "next/navigation";

export default async function LevelUpPage() {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) redirect("/dashboard/community");
  const home = await loadCommunityHome(admin, user.id);
  if (home.level == null) redirect("/dashboard/community/level");
  const mates = [
    { userId: user.id, name: "You", level: home.level },
    ...home.podmates.filter((mate) => mate.userId !== user.id),
  ];
  const when = home.next
    ? `${formatWeekdayDate(home.next.startsAt, home.timezone)} · Week ${home.next.weekNumber}${home.next.topic ? ` · ${home.next.topic}` : ""}`
    : "Your next session";
  return <Celebration level={home.level} podName={home.pod?.name ?? "Your pod"} mates={mates} when={when} invited hideCalendar />;
}
