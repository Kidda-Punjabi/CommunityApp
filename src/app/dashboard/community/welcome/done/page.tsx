import { Celebration } from "@/components/community/celebration";
import { formatWeekdayDate } from "@/lib/community/format";
import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { assignMemberPod } from "@/lib/community/mutations";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { redirect } from "next/navigation";

export default async function WelcomeDonePage() {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) redirect("/dashboard/community");
  let home = await loadCommunityHome(admin, user.id);
  if (home.level == null) redirect("/dashboard/community/welcome/levels");
  if (!home.pod && home.mainSessionId) {
    await assignMemberPod(admin, user.id);
    home = await loadCommunityHome(admin, user.id);
  }
  const { data: meta } = await admin
    .from("community_memberships_meta")
    .select("calendar_invite_status")
    .eq("user_id", user.id)
    .maybeSingle();
  const self = home.podmates.find((mate) => mate.userId === user.id);
  const mates = [
    { userId: user.id, name: "You", level: home.level },
    ...home.podmates.filter((mate) => mate.userId !== user.id),
  ];
  const level = home.level;
  if (level == null) redirect("/dashboard/community/welcome/levels");
  if (self) mates[0] = { userId: user.id, name: "You", level };
  return (
    <Celebration
      level={level}
      podName={home.pod?.name ?? "Your pod"}
      mates={mates}
      when={home.next ? `${formatWeekdayDate(home.next.startsAt, home.timezone)} · Week ${home.next.weekNumber}${home.next.topic ? ` · ${home.next.topic}` : ""}` : "Your first session is on the way"}
      invited={meta?.calendar_invite_status === "sent"}
    />
  );
}
